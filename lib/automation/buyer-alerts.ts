import "server-only";
import { zipInfo } from "@/lib/areas";
import { sendEmailBatch, type EmailArgs } from "@/lib/email";
import { alertAreaLabel, alertUnsubscribe } from "@/lib/listing-alerts";
import { formatPrice } from "@/lib/listings";
import { getMarketById } from "@/lib/market-data";
import { brandName, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { listingCardBlock, loadListingsForCards, type ListingForCard } from "./listing-card";
import { localDate } from "./time";

/** Instant alert emails per subscriber per market-local day. Listings past this wait for the next morning's digest. */
export const DAILY_ALERT_CAP = 3;

const PAGE = 1000;

export type AlertRecipient = { id: string; email: string; zip: string | null; unsubscribe_token: string };

export type AlertSendSummary = { listingId: string; matched: number; sent: number; queued: number; failed: number };

async function activeAlerts(marketId: string): Promise<AlertRecipient[]> {
  const admin = createAdminClient();
  const rows: AlertRecipient[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("listing_alerts")
      .select("id, email, zip, unsubscribe_token")
      .eq("market_id", marketId)
      .is("unsubscribed_at", null)
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load listing alerts: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** A subscriber wants a listing when their ZIP is empty (the whole market), the same ZIP, or a ZIP in the same county. */
export function alertMatches(market: Market, alertZip: string | null, listingZip: string) {
  if (!alertZip || alertZip === listingZip) return true;
  const county = zipInfo(market, listingZip)?.county;
  return Boolean(county && zipInfo(market, alertZip)?.county === county);
}

function matchReason(market: Market, alertZip: string | null, listingZip: string) {
  if (!alertZip) return `your alert for all of ${market.region}`;
  if (alertZip === listingZip) return `your alert for ZIP ${alertAreaLabel(market, alertZip)}`;
  return `your alert for ZIP ${alertAreaLabel(market, alertZip)}, since it's in ${zipInfo(market, listingZip)?.county} County`;
}

export function instantAlertEmail(market: Market, alert: AlertRecipient, listing: ListingForCard): EmailArgs {
  const card = listingCardBlock(market, listing);
  const place = card.kind === "listing" ? card.place : market.name;
  return {
    market,
    to: alert.email,
    subject: `New listing: ${formatPrice(listing.price)} · ${Number(listing.beds)} bd in ${place.split(", ")[0]}`,
    heading: "A new home was just listed",
    blocks: [
      { kind: "p", text: `It matches ${matchReason(market, alert.zip, listing.zip)}.` },
      card,
      { kind: "p", text: `Every home on ${brandName(market)} is listed by its owner. Message the seller from the listing page.` },
    ],
    unsubscribe: alertUnsubscribe(market, alert.unsubscribe_token),
  };
}

/**
 * Emails subscribers about a newly approved listing. Each (subscriber, listing) pair is claimed with a unique row
 * before sending, so repeated approvals or overlapping runs never send a listing twice. Subscribers who already got
 * DAILY_ALERT_CAP instant alerts today get the listing queued for the next morning's digest instead.
 */
export async function sendNewListingAlerts(listingId: string): Promise<AlertSendSummary> {
  const admin = createAdminClient();
  const summary: AlertSendSummary = { listingId, matched: 0, sent: 0, queued: 0, failed: 0 };
  const listing = (await loadListingsForCards([listingId])).get(listingId);
  if (!listing || listing.status !== "active") return summary;
  const market = await getMarketById(listing.market_id);

  const matching = (await activeAlerts(market.id)).filter((a) => alertMatches(market, a.zip, listing.zip));
  summary.matched = matching.length;
  if (matching.length === 0) return summary;

  // Today's instant sends per subscriber, in the market's time zone.
  const today = localDate(market.timezone);
  const sentToday = new Map<string, number>();
  for (let i = 0; i < matching.length; i += 200) {
    const { data, error } = await admin
      .from("listing_alert_sends")
      .select("alert_id")
      .in("alert_id", matching.slice(i, i + 200).map((a) => a.id))
      .eq("via", "instant")
      .eq("send_date", today)
      .in("status", ["sending", "sent"]);
    if (error) throw new Error(`Could not count today's alerts: ${error.message}`);
    for (const row of data) sentToday.set(row.alert_id, (sentToday.get(row.alert_id) ?? 0) + 1);
  }

  const claims = matching.map((a) => {
    const instant = (sentToday.get(a.id) ?? 0) < DAILY_ALERT_CAP;
    return {
      alert_id: a.id,
      listing_id: listing.id,
      market_id: market.id,
      status: instant ? ("sending" as const) : ("queued" as const),
      via: instant ? ("instant" as const) : null,
      send_date: instant ? today : null,
    };
  });

  // Only rows that didn't exist yet come back, so anyone already sent (or queued) this listing is skipped.
  const claimed: { id: string; alert_id: string; status: string }[] = [];
  for (let i = 0; i < claims.length; i += 500) {
    const { data, error } = await admin
      .from("listing_alert_sends")
      .upsert(claims.slice(i, i + 500), { onConflict: "alert_id,listing_id", ignoreDuplicates: true })
      .select("id, alert_id, status");
    if (error) throw new Error(`Could not record alert sends: ${error.message}`);
    claimed.push(...data);
  }

  summary.queued = claimed.filter((c) => c.status === "queued").length;
  const toSend = claimed.filter((c) => c.status === "sending");
  if (toSend.length === 0) return summary;

  const alertsById = new Map(matching.map((a) => [a.id, a]));
  const results = await sendEmailBatch(
    toSend.map((c) => instantAlertEmail(market, alertsById.get(c.alert_id)!, listing)),
    // Unique per claimed set: a later approval that finds new subscribers must not reuse the key with other emails.
    `listing-alerts:${listing.id}:${toSend[0].id}`,
  );

  const now = new Date().toISOString();
  const updates = toSend.map((c, i) => {
    const r = results[i];
    return {
      id: c.id,
      alert_id: c.alert_id,
      listing_id: listing.id,
      market_id: market.id,
      via: "instant" as const,
      send_date: today,
      ...(r.ok ? { status: "sent" as const, resend_id: r.id, sent_at: now } : { status: "failed" as const, error: r.error.slice(0, 1000) }),
    };
  });
  const { error } = await admin.from("listing_alert_sends").upsert(updates, { onConflict: "id" });
  if (error) console.error("could not update alert send log", error.message);

  summary.sent = results.filter((r) => r.ok).length;
  summary.failed = results.length - summary.sent;
  return summary;
}

export type DigestSummary = { subscribers: number; listings: number; skipped: number; failed: number };

/** Sends each subscriber one email with the listings queued past yesterday's cap, then marks them sent. */
export async function sendAlertDigests(): Promise<DigestSummary> {
  const admin = createAdminClient();
  const summary: DigestSummary = { subscribers: 0, listings: 0, skipped: 0, failed: 0 };

  const { data: queued, error } = await admin
    .from("listing_alert_sends")
    .select("id, alert_id, listing_id, market_id, listing_alerts!inner(email, zip, unsubscribe_token, unsubscribed_at)")
    .eq("status", "queued")
    .order("created_at")
    .limit(5000);
  if (error) throw new Error(`Could not load queued alerts: ${error.message}`);
  if (queued.length === 0) return summary;

  const listings = await loadListingsForCards([...new Set(queued.map((q) => q.listing_id))]);

  // Listings no longer for sale and subscribers who unsubscribed are dropped, not sent.
  const skipIds = queued.filter((q) => q.listing_alerts.unsubscribed_at || listings.get(q.listing_id)?.status !== "active").map((q) => q.id);
  if (skipIds.length) {
    await admin.from("listing_alert_sends").update({ status: "skipped" }).in("id", skipIds);
    summary.skipped = skipIds.length;
  }

  const bySubscriber = new Map<string, typeof queued>();
  for (const q of queued) {
    if (skipIds.includes(q.id)) continue;
    bySubscriber.set(q.alert_id, [...(bySubscriber.get(q.alert_id) ?? []), q]);
  }

  // Group sends by market so each batch shares a sender.
  const byMarket = new Map<string, { rows: typeof queued; email: EmailArgs }[]>();
  for (const rows of bySubscriber.values()) {
    const market = await getMarketById(rows[0].market_id);
    const alert = rows[0].listing_alerts;
    const email = alertDigestEmail(market, alert, rows.map((r) => listings.get(r.listing_id)!));
    byMarket.set(market.id, [...(byMarket.get(market.id) ?? []), { rows, email }]);
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const [marketId, items] of byMarket) {
    const results = await sendEmailBatch(items.map((i) => i.email), `alert-digest:${marketId}:${today}:${items[0].rows[0].id}`);
    const now = new Date().toISOString();
    for (const [i, item] of items.entries()) {
      const r = results[i];
      const ids = item.rows.map((row) => row.id);
      if (r.ok) {
        await admin.from("listing_alert_sends").update({ status: "sent", via: "digest", resend_id: r.id, sent_at: now }).in("id", ids);
        summary.subscribers += 1;
        summary.listings += ids.length;
      } else {
        // Left queued so tomorrow's run tries again.
        console.error("alert digest failed", item.email.to, r.error);
        summary.failed += 1;
      }
    }
  }
  return summary;
}

export function alertDigestEmail(market: Market, alert: { email: string; unsubscribe_token: string }, homes: ListingForCard[]): EmailArgs {
  return {
    market,
    to: alert.email,
    subject: `${homes.length} new ${homes.length === 1 ? "home" : "homes"} for sale by owner in ${market.name}`,
    heading: `${homes.length} more new ${homes.length === 1 ? "home" : "homes"} for you`,
    blocks: [
      { kind: "p", text: `We send up to ${DAILY_ALERT_CAP} new listings a day as they're approved. These matched your alert after that, so here they are together.` },
      ...homes.map((home) => listingCardBlock(market, home)),
      { kind: "p", text: `Every home on ${brandName(market)} is listed by its owner. Message the seller from the listing page.` },
    ],
    unsubscribe: alertUnsubscribe(market, alert.unsubscribe_token),
  };
}
