import "server-only";
import { adminEmail, sendEmailWithId, siteLink, type EmailArgs, type EmailBlock } from "@/lib/email";
import { fullAddress } from "@/lib/listings";
import { attachLeadTargets } from "@/lib/leads";
import { getMarkets } from "@/lib/market-data";
import { brandName, COMPANY, DEFAULT_MARKET_SLUG, isLive, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";
import type { DigestSummary } from "./buyer-alerts";
import type { LifecycleSummary } from "./vendor-lifecycle";
import { daysAgo, localDate, zonedMidnight } from "./time";

/** The founder's own time zone, for "yesterday". */
const FOUNDER_TIME_ZONE = "America/Chicago";
const LIST_MAX = 15;

export type RunReport = { alertDigests?: DigestSummary; vendorEmails?: LifecycleSummary; errors: string[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function capped<T>(items: T[], render: (item: T) => string): EmailBlock[] {
  if (items.length === 0) return [];
  return [
    { kind: "list", items: items.slice(0, LIST_MAX).map((i) => ({ text: render(i) })) },
    ...(items.length > LIST_MAX ? [{ kind: "p" as const, text: `And ${items.length - LIST_MAX} more.` }] : []),
  ];
}

/**
 * Once a day to ADMIN_EMAIL: what needs review, new leads, quiet vendors, yesterday's alert signups, anything the
 * automation skipped or failed, and a line per market. Nothing is sent when there's nothing to report.
 */
export async function buildFounderDigest(report: RunReport, now = new Date(), { force = false } = {}): Promise<EmailArgs | null> {
  const admin = createAdminClient();
  const markets = await getMarkets();
  const byId = new Map(markets.map((m) => [m.id, m]));
  const label = (marketId: string) => {
    const m = byId.get(marketId);
    return m ? `${brandName(m)}${isLive(m) ? "" : " (pre-launch)"}` : "Unknown market";
  };
  const dayAgo = daysAgo(1, now).toISOString();

  // Yesterday as a calendar day in the founder's time zone.
  const [y, mo, d] = localDate(FOUNDER_TIME_ZONE, now).split("-").map(Number);
  const todayStart = zonedMidnight(FOUNDER_TIME_ZONE, y, mo, d);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const [pendingVendors, pendingListings, pendingEdits, recentLeads, approvedVendors, signups, syndication, alertSends, activeListings, activeAlerts] =
    await Promise.all([
      admin.from("vendors").select("business_name, category, market_id, created_at").eq("status", "pending").order("created_at"),
      admin.from("listings").select("street, city, zip, market_id, created_at").eq("status", "pending").order("created_at"),
      admin.from("vendor_pending_edits").select("business_name, submitted_at, vendors!inner(market_id)").order("submitted_at"),
      admin.from("leads").select("*").gte("created_at", dayAgo).order("created_at", { ascending: false }),
      admin.from("vendors").select("id, business_name, category, market_id, approved_at").eq("status", "approved"),
      admin.from("listing_alerts").select("market_id").gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString()),
      admin.from("listing_syndication").select("status, error, market_id, created_at").gte("updated_at", dayAgo).in("status", ["skipped", "failed"]),
      admin.from("listing_alert_sends").select("status, via").gte("created_at", dayAgo),
      admin.from("listings").select("market_id").eq("status", "active"),
      admin.from("listing_alerts").select("market_id").is("unsubscribed_at", null),
    ]);
  for (const r of [pendingVendors, pendingListings, pendingEdits, recentLeads, approvedVendors, signups, syndication, alertSends, activeListings, activeAlerts]) {
    if (r.error) throw new Error(`Founder digest query failed: ${r.error.message}`);
  }

  const liveIds = new Set(markets.filter(isLive).map((m) => m.id));
  const veterans = (approvedVendors.data ?? []).filter((v) => liveIds.has(v.market_id) && v.approved_at && Date.parse(v.approved_at) <= daysAgo(30, now).getTime());
  const withLeads = new Set<string>();
  for (let i = 0; i < veterans.length; i += 200) {
    const { data, error } = await admin.from("leads").select("target_id").eq("type", "vendor").in("target_id", veterans.slice(i, i + 200).map((v) => v.id));
    if (error) throw new Error(`Founder digest query failed: ${error.message}`);
    for (const l of data) withLeads.add(l.target_id);
  }
  const quietVendors = veterans.filter((v) => !withLeads.has(v.id));
  const leads = await attachLeadTargets(recentLeads.data ?? []);
  const facebookIssues = syndication.data ?? [];
  const alertFailures = (alertSends.data ?? []).filter((s) => s.status === "failed").length;
  const emailFailures = alertFailures + (report.alertDigests?.failed ?? 0) + (report.vendorEmails?.failed ?? 0);

  const reviewCount = (pendingVendors.data?.length ?? 0) + (pendingListings.data?.length ?? 0) + (pendingEdits.data?.length ?? 0);
  const signupCount = signups.data?.length ?? 0;
  const hasNews = reviewCount + leads.length + quietVendors.length + signupCount + facebookIssues.length + emailFailures + report.errors.length > 0;
  if (!hasNews && !force) return null;

  const market = markets.find((m) => m.slug === DEFAULT_MARKET_SLUG) ?? markets[0];
  const adminLink = (path: string) => siteLink(market, path);
  const blocks: EmailBlock[] = [];

  if (report.errors.length) {
    blocks.push({ kind: "heading", text: "The daily run hit errors" }, ...capped(report.errors, (e) => e));
  }

  blocks.push({ kind: "heading", text: reviewCount ? `Waiting for review (${reviewCount})` : "Nothing waiting for review" });
  blocks.push(...capped(pendingVendors.data ?? [], (v) => `Vendor: ${v.business_name}, ${categoryByValue(v.category).singular} · ${label(v.market_id)}`));
  blocks.push(
    ...capped(pendingListings.data ?? [], (l) => {
      const m = byId.get(l.market_id);
      return `Listing: ${m ? fullAddress(m, l) : l.street} · ${label(l.market_id)}`;
    }),
  );
  blocks.push(...capped(pendingEdits.data ?? [], (e) => `Profile edit: ${e.business_name} · ${label(e.vendors.market_id)}`));
  if (reviewCount) blocks.push({ kind: "button", label: "Open admin", href: adminLink("/admin?market=all") });

  blocks.push({ kind: "heading", text: `Leads in the last 24 hours (${leads.length})` });
  blocks.push(...capped(leads, (l) => `${l.sender_name} to ${l.targetLabel} (${l.type}) · ${label(l.market_id)}`));
  if (leads.length === 0) blocks.push({ kind: "p", text: "No new leads." });

  if (quietVendors.length) {
    blocks.push({ kind: "heading", text: `Approved 30+ days, no inquiries yet (${quietVendors.length})` });
    blocks.push(
      ...capped(quietVendors, (v) => `${v.business_name}, ${categoryByValue(v.category).singular} · ${label(v.market_id)} · approved ${Math.floor((now.getTime() - Date.parse(v.approved_at!)) / 86_400_000)} days ago`),
    );
  }

  blocks.push({ kind: "heading", text: `Alert signups yesterday (${signupCount})` });
  if (signupCount) {
    const perMarket = new Map<string, number>();
    for (const s of signups.data ?? []) perMarket.set(s.market_id, (perMarket.get(s.market_id) ?? 0) + 1);
    blocks.push({ kind: "list", items: [...perMarket].map(([id, n]) => ({ text: `${label(id)}: ${n}` })) });
  }

  const automation: string[] = [];
  const sends = alertSends.data ?? [];
  const instantSent = sends.filter((s) => s.status === "sent" && s.via === "instant").length;
  const queuedCount = sends.filter((s) => s.status === "queued").length;
  if (instantSent || queuedCount || alertFailures) automation.push(`Buyer alerts: ${plural(instantSent, "email")} sent, ${queuedCount} queued for the digest, ${alertFailures} failed`);
  if (report.alertDigests && (report.alertDigests.subscribers || report.alertDigests.failed))
    automation.push(`Alert digests: ${plural(report.alertDigests.subscribers, "subscriber")} (${plural(report.alertDigests.listings, "listing")}), ${report.alertDigests.failed} failed`);
  if (report.vendorEmails) {
    const v = report.vendorEmails;
    if (v.day2 + v.day14 + v.monthly + v.failed) automation.push(`Vendor emails: ${v.day2} day-2, ${v.day14} day-14, ${v.monthly} monthly, ${v.failed} failed`);
  }
  for (const f of facebookIssues) {
    automation.push(`Facebook ${f.status === "skipped" ? "post skipped" : "post failed"} for ${label(f.market_id)}: ${f.error ?? "no details"}`);
  }
  if (automation.length) blocks.push({ kind: "heading", text: "Automation" }, { kind: "list", items: automation.map((text) => ({ text })) });

  blocks.push({ kind: "heading", text: "Markets" });
  const count = (rows: { market_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.market_id === id).length;
  blocks.push({
    kind: "list",
    items: markets.map((m: Market) => ({
      text: `${brandName(m)} (${isLive(m) ? "live" : "coming soon"}): ${plural(count(approvedVendors.data, m.id), "vendor")} · ${plural(count(activeListings.data, m.id), "active listing")} · ${plural(count(activeAlerts.data, m.id), "alert subscriber")} · ${plural(count(recentLeads.data, m.id), "lead")} in 24h`,
    })),
  });

  const summaryBits = [reviewCount && `${reviewCount} to review`, leads.length && plural(leads.length, "new lead"), signupCount && plural(signupCount, "alert signup")].filter(Boolean);
  return {
    market,
    to: adminEmail(),
    subject: `${COMPANY.name} morning digest${summaryBits.length ? `: ${summaryBits.join(", ")}` : ""}`,
    heading: `Good morning. Here's ${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: FOUNDER_TIME_ZONE }).format(now)}.`,
    blocks,
  };
}

export async function sendFounderDigest(report: RunReport, now = new Date()): Promise<"sent" | "skipped" | "failed"> {
  const email = await buildFounderDigest(report, now);
  if (!email) return "skipped";
  return (await sendEmailWithId(email)).ok ? "sent" : "failed";
}
