import { areaForZip } from "@/lib/areas";
import { getCurrentProfile } from "@/lib/auth";
import type { Lead, ListingAlert } from "@/lib/database.types";
import { readInterestDetails } from "@/lib/interest";
import { attachLeadTargets } from "@/lib/leads";
import { getMarkets } from "@/lib/market-data";
import type { Market } from "@/lib/markets";
import { formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";

export const dynamic = "force-dynamic";

const PAGE = 1000;

/** Quotes a CSV cell, and neutralizes values a spreadsheet would run as a formula (CSV injection). */
function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const chicago = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", hour12: false }).replace(",", "") : "";

async function fetchAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Which markets an export covers (?market=<slug>, or all), plus a lookup for the market column. */
type ExportScope = { market: Market | null; byId: Map<string, Market> };

const marketCell = (scope: ExportScope, marketId: string) => scope.byId.get(marketId)?.slug ?? "";

async function vendorsCsv(scope: ExportScope) {
  const admin = createAdminClient();
  const vendors = await fetchAll((from, to) => {
    const query = admin
      .from("vendors")
      .select("*, profiles!inner(full_name, email, phone), vendor_certifications(certified_at), vendor_pending_edits(submitted_at), vendor_verifications(license_number, submitted_at, verified_at)")
      .order("created_at")
      .range(from, to);
    return scope.market ? query.eq("market_id", scope.market.id) : query;
  });
  const leads = await fetchAll((from, to) => admin.from("leads").select("target_id").eq("type", "vendor").range(from, to));
  const leadCounts = new Map<string, number>();
  for (const l of leads) leadCounts.set(l.target_id, (leadCounts.get(l.target_id) ?? 0) + 1);

  const header = [
    "vendor_id", "market", "pre_launch", "business_name", "category", "status", "founding_vendor", "contact_name", "email", "phone",
    "service_area", "price_range", "website", "leads_all_time", "edit_pending_since", "certified_at",
    "license_number", "verification_submitted_at", "verified_at", "created_at",
  ];
  const rows = vendors.map((v) => [
    v.id, marketCell(scope, v.market_id), scope.byId.get(v.market_id)?.status === "coming_soon" ? "yes" : "no", v.business_name, categoryByValue(v.category).singular, v.status, v.founding_vendor ? "yes" : "no",
    v.profiles.full_name, v.profiles.email, formatUsPhone(v.profiles.phone), v.service_area, v.price_range, v.website,
    leadCounts.get(v.id) ?? 0, chicago(v.vendor_pending_edits?.submitted_at), chicago(v.vendor_certifications?.certified_at),
    v.vendor_verifications?.license_number, chicago(v.vendor_verifications?.submitted_at), chicago(v.vendor_verifications?.verified_at),
    chicago(v.created_at),
  ]);
  return toCsv(header, rows);
}

async function leadsCsv(scope: ExportScope) {
  const admin = createAdminClient();
  const leads = await fetchAll<Lead>((from, to) => {
    const query = admin.from("leads").select("*").order("created_at", { ascending: false }).range(from, to);
    return scope.market ? query.eq("market_id", scope.market.id) : query;
  });
  const withTargets = await attachLeadTargets(leads);
  const header = [
    "lead_id", "market", "created_at", "type", "sent_to", "recipient_email", "sender_name", "sender_email", "sender_phone",
    "message", "consent", "source_page", "offer_amount", "financing", "pre_approved", "target_close",
  ];
  const rows = withTargets.map((l) => {
    // The last four columns are filled in only for an expression of interest.
    const d = readInterestDetails(l.details);
    return [
      l.id, marketCell(scope, l.market_id), chicago(l.created_at), l.type, l.targetLabel, l.recipientEmail, l.sender_name, l.sender_email,
      formatUsPhone(l.sender_phone), l.message, l.consent ? "yes" : "no", l.source,
      d?.offer_amount ?? "", d?.financing ?? "", d ? (d.financing === "cash" ? "cash" : d.pre_approved ? "yes" : "no") : "", d?.target_close ?? "",
    ];
  });
  return toCsv(header, rows);
}

async function alertsCsv(scope: ExportScope) {
  const admin = createAdminClient();
  const alerts = await fetchAll<Pick<ListingAlert, "email" | "zip" | "created_at" | "unsubscribed_at" | "market_id">>((from, to) => {
    const query = admin.from("listing_alerts").select("email, zip, created_at, unsubscribed_at, market_id").order("created_at", { ascending: false }).range(from, to);
    return scope.market ? query.eq("market_id", scope.market.id) : query;
  });
  const header = ["market", "email", "zip", "area", "status", "signed_up_at", "unsubscribed_at"];
  const rows = alerts.map((a) => [
    marketCell(scope, a.market_id), a.email, a.zip, a.zip && scope.byId.get(a.market_id) ? areaForZip(scope.byId.get(a.market_id)!, a.zip) : "", a.unsubscribed_at ? "unsubscribed" : "active", chicago(a.created_at), chicago(a.unsubscribed_at),
  ]);
  return toCsv(header, rows);
}

export async function GET(request: Request, { params }: RouteContext<"/[market]/admin/export/[file]">) {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return new Response("Not found", { status: 404 });

  const { market: siteSlug, file } = await params;
  const markets = await getMarkets();
  const requested = new URL(request.url).searchParams.get("market") ?? siteSlug;
  const scope: ExportScope = {
    market: requested === "all" ? null : markets.find((m) => m.slug === requested) ?? null,
    byId: new Map(markets.map((m) => [m.id, m])),
  };
  if (requested !== "all" && !scope.market) return new Response("Unknown market", { status: 404 });

  const builders: Record<string, (scope: ExportScope) => Promise<string>> = { "vendors.csv": vendorsCsv, "leads.csv": leadsCsv, "alerts.csv": alertsCsv };
  const build = builders[file];
  if (!build) return new Response("Not found", { status: 404 });

  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return new Response(`\uFEFF${await build(scope)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ownvista-${scope.market?.slug ?? "all-markets"}-${file.replace(".csv", "")}-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
