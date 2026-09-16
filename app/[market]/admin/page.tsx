import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, EmptyState } from "@/components/ui";
import { areaForZip, locationLine } from "@/lib/areas";
import { requireAdmin } from "@/lib/auth";
import type { Lead } from "@/lib/database.types";
import { interestRows, readInterestDetails } from "@/lib/interest";
import { attachLeadTargets } from "@/lib/leads";
import { formatPrice } from "@/lib/listings";
import { getMarkets, requireMarket } from "@/lib/market-data";
import { brandName, isLive, type Market } from "@/lib/markets";
import { formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";
import { approveListing, approveVendor, approveVendorEdit, rejectListing, rejectVendor, setMarketStatus } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

const TABS = [
  { key: "vendors", label: "Pending Vendors" },
  { key: "all-vendors", label: "All Vendors" },
  { key: "listings", label: "Pending Listings" },
  { key: "drafts", label: "Drafts" },
  { key: "funnel", label: "Funnel" },
  { key: "leads", label: "All Leads" },
  { key: "buyers", label: "Buyers" },
  { key: "markets", label: "Markets" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const LEADS_PAGE_SIZE = 50;
const VENDORS_PAGE_SIZE = 50;
const VENDOR_STATUSES = ["pending", "approved", "rejected"] as const;
type VendorStatusFilter = (typeof VENDOR_STATUSES)[number];
/** The Buyers tab shows the most recent of each list; the CSV exports hold everything. */
const BUYERS_PREVIEW = 50;

const notices: Record<string, string> = {
  approved: "Approved, and the email was sent.",
  rejected: "Rejected, and the email was sent.",
  "edit-approved": "Edit approved. The changes are live and the vendor was emailed.",
  already: "That was already handled, so no email was sent again.",
  "market-live": "The market is live. Its listings, directory, and guides are now public.",
  "market-coming-soon": "The market is back to coming soon. Its listings and directory are hidden.",
  "confirm-required": "Check the confirmation box to change a market's status.",
};

/** The market filter: one market's rows, or every market's. Defaults to the site the admin is on. */
type Scope = { market: Market | null; param: string };

const withScope = (scope: Scope, path: string) => `${path}${path.includes("?") ? "&" : "?"}market=${scope.param}`;

function MarketBadge({ market }: { market: Market | undefined }) {
  if (!market) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[12px] font-semibold" title={brandName(market)}>
      {market.short_name}
      {!isLive(market) && <span className="rounded-full bg-warm/15 px-1.5 text-ink">Pre-launch</span>}
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const leadKindLabel = (type: Lead["type"]) =>
  type === "vendor" ? "Vendor inquiry" : type === "interest" ? "Expression of interest" : "Listing inquiry";

export default async function AdminPage({ params: routeParams, searchParams }: PageProps<"/[market]/admin">) {
  const siteMarket = await requireMarket((await routeParams).market);
  await requireAdmin("/admin");
  const params = await searchParams;
  const markets = await getMarkets();
  const marketParam = typeof params.market === "string" ? params.market : siteMarket.slug;
  const scope: Scope = marketParam === "all" ? { market: null, param: "all" } : { market: markets.find((m) => m.slug === marketParam) ?? siteMarket, param: "" };
  scope.param = scope.market?.slug ?? "all";
  const marketsById = new Map(markets.map((m) => [m.id, m]));
  // Adds the market condition to a query when the filter is a single market.
  const scoped = <Q extends { eq: (column: string, value: string) => Q }>(query: Q, column = "market_id") => (scope.market ? query.eq(column, scope.market.id) : query);
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "vendors";
  const page = Math.max(1, Number(params.page) || 1);
  const leadType = params.type === "vendor" || params.type === "listing" || params.type === "interest" ? params.type : undefined;
  const notice = notices[String(params.done ?? "")];

  const admin = createAdminClient();
  const [vendorsCount, editsCount, listingsCount, leadsCount, alertsActive, alertsTotal, buyersCount, draftsCount, allVendorsCount] = await Promise.all([
    scoped(admin.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending")),
    scoped(admin.from("vendor_pending_edits").select("vendor_id, vendors!inner(market_id)", { count: "exact", head: true }), "vendors.market_id"),
    scoped(admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending")),
    scoped(admin.from("leads").select("id", { count: "exact", head: true })),
    scoped(admin.from("listing_alerts").select("id", { count: "exact", head: true }).is("unsubscribed_at", null)),
    scoped(admin.from("listing_alerts").select("id", { count: "exact", head: true })),
    scoped(admin.from("profiles").select("id", { count: "exact", head: true }).contains("roles", ["buyer"])),
    scoped(admin.from("listing_drafts").select("id", { count: "exact", head: true }).neq("status", "verified")),
    scoped(admin.from("vendors").select("id", { count: "exact", head: true })),
  ]);
  const alertSubscribers = alertsActive.count ?? 0;
  const alertUnsubscribed = (alertsTotal.count ?? 0) - alertSubscribers;
  const counts: Record<Tab, number> = {
    vendors: (vendorsCount.count ?? 0) + (editsCount.count ?? 0),
    "all-vendors": allVendorsCount.count ?? 0,
    listings: listingsCount.count ?? 0,
    drafts: draftsCount.count ?? 0,
    funnel: 0,
    leads: leadsCount.count ?? 0,
    buyers: (buyersCount.count ?? 0) + (alertsTotal.count ?? 0),
    markets: markets.length,
  };

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Admin</h1>
          <p className="mt-2 text-[15px] text-muted">
            {scope.market ? brandName(scope.market) : "All markets"} · Listing alert signups: <strong className="font-semibold text-ink">{alertSubscribers.toLocaleString("en-US")}</strong> active
            {alertUnsubscribed > 0 ? ` · ${alertUnsubscribed.toLocaleString("en-US")} unsubscribed` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[15px]">
          <a href={withScope(scope, "/admin/export/vendors.csv")} className="font-medium text-forest underline underline-offset-2">
            Export vendors (CSV)
          </a>
          <a href={withScope(scope, "/admin/export/leads.csv")} className="font-medium text-forest underline underline-offset-2">
            Export leads (CSV)
          </a>
          <a href={withScope(scope, "/admin/export/alerts.csv")} className="font-medium text-forest underline underline-offset-2">
            Export listing alerts (CSV)
          </a>
          <a href={withScope(scope, "/admin/export/buyers.csv")} className="font-medium text-forest underline underline-offset-2">
            Export buyers (CSV)
          </a>
        </div>
      </div>

      <nav aria-label="Market filter" className="mt-6 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="mr-1 text-muted">Market</span>
        {[{ slug: "all", label: "All markets" }, ...markets.map((m) => ({ slug: m.slug, label: brandName(m) }))].map((option) => (
          <Link
            key={option.slug}
            href={`/admin?tab=${tab}&market=${option.slug}`}
            aria-current={scope.param === option.slug ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${scope.param === option.slug ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Admin sections" className="-mx-4 mt-6 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-6 whitespace-nowrap">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={withScope(scope, `/admin?tab=${t.key}`)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[16px] font-medium ${tab === t.key ? "border-forest text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
                <span className={`rounded-full px-2 text-[13px] ${tab === t.key ? "bg-forest text-white" : "bg-surface"}`}>{counts[t.key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px]">
          {notice}
        </p>
      )}

      <div className="mt-8">
        {tab === "vendors" && <PendingVendors scope={scope} marketsById={marketsById} />}
        {tab === "all-vendors" && (
          <AllVendors
            scope={scope}
            marketsById={marketsById}
            page={page}
            query={typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""}
            status={VENDOR_STATUSES.find((s) => s === params.status)}
          />
        )}
        {tab === "listings" && <PendingListings scope={scope} marketsById={marketsById} />}
        {tab === "drafts" && <Drafts scope={scope} marketsById={marketsById} />}
        {tab === "funnel" && <Funnel scope={scope} source={typeof params.source === "string" ? params.source : ""} />}
        {tab === "leads" && <AllLeads scope={scope} marketsById={marketsById} page={page} type={leadType} />}
        {tab === "buyers" && <Buyers scope={scope} marketsById={marketsById} />}
        {tab === "markets" && <Markets markets={markets} returnTo={withScope(scope, "/admin?tab=markets")} />}
      </div>
    </Container>
  );
}

type TabProps = { scope: Scope; marketsById: Map<string, Market> };

async function PendingVendors({ scope, marketsById }: TabProps) {
  const admin = createAdminClient();
  let vendorQuery = admin
    .from("vendors")
    .select("id, business_name, category, headshot_url, service_area, created_at, market_id, profiles!inner(email, phone)")
    .eq("status", "pending")
    .order("created_at");
  let editQuery = admin
    .from("vendor_pending_edits")
    .select("vendor_id, business_name, category, headshot_url, submitted_at, vendors!inner(business_name, category, market_id)")
    .order("submitted_at");
  if (scope.market) {
    vendorQuery = vendorQuery.eq("market_id", scope.market.id);
    editQuery = editQuery.eq("vendors.market_id", scope.market.id);
  }
  const [{ data: vendors }, { data: edits }] = await Promise.all([vendorQuery, editQuery]);
  const returnTo = withScope(scope, "/admin?tab=vendors");

  return (
    <div className="space-y-10">
      <section aria-labelledby="new-vendors">
        <h2 id="new-vendors" className="text-xl font-semibold tracking-tight">
          New applications <span className="text-muted">({vendors?.length ?? 0})</span>
        </h2>
        {vendors?.length ? (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {vendors.map((v) => (
              <li key={v.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    <Image src={v.headshot_url} alt="" fill sizes="56px" className="object-cover object-top" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/vendors/${v.id}`} className="font-semibold hover:underline">
                        {v.business_name}
                      </Link>
                      <MarketBadge market={marketsById.get(v.market_id)} />
                    </div>
                    <p className="text-[14px] text-muted">
                      {categoryByValue(v.category).singular} · {v.service_area} · {dateFmt.format(new Date(v.created_at))}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {v.profiles.email} · {formatUsPhone(v.profiles.phone)}
                    </p>
                  </div>
                </div>
                <RowActions approve={approveVendor} reject={rejectVendor} idName="vendor_id" id={v.id} returnTo={returnTo} reviewHref={`/admin/vendors/${v.id}`} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No vendors waiting for approval" />
          </div>
        )}
      </section>

      <section aria-labelledby="vendor-edits">
        <h2 id="vendor-edits" className="text-xl font-semibold tracking-tight">
          Edits to live profiles <span className="text-muted">({edits?.length ?? 0})</span>
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          Approved profiles stay live until you approve. Open Compare to see the changes side by side or decline with a note.
        </p>
        {edits?.length ? (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {edits.map((e) => (
              <li key={e.vendor_id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    <Image src={e.headshot_url} alt="" fill sizes="56px" className="object-cover object-top" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/vendors/${e.vendor_id}`} className="font-semibold hover:underline">
                        {e.business_name}
                      </Link>
                      <MarketBadge market={marketsById.get(e.vendors.market_id)} />
                    </div>
                    <p className="text-[14px] text-muted">
                      {e.vendors.business_name !== e.business_name ? `Was ${e.vendors.business_name} · ` : ""}
                      {categoryByValue(e.category).singular}
                      {e.vendors.category !== e.category ? ` (was ${categoryByValue(e.vendors.category).singular})` : ""} ·{" "}
                      {dateFmt.format(new Date(e.submitted_at))}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <form action={approveVendorEdit}>
                    <input type="hidden" name="vendor_id" value={e.vendor_id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <SubmitButton pendingLabel="Approving">Approve edit</SubmitButton>
                  </form>
                  <Link href={`/admin/vendors/${e.vendor_id}`} className="text-[15px] font-medium text-forest underline underline-offset-2">
                    Compare
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No edits waiting for review" />
          </div>
        )}
      </section>
    </div>
  );
}

async function PendingListings({ scope, marketsById }: TabProps) {
  let query = createAdminClient()
    .from("listings")
    .select("id, street, city, zip, price, beds, baths, hide_exact_address, created_at, market_id, profiles!inner(email), listing_photos(url, sort_order)")
    .eq("status", "pending")
    .order("created_at");
  if (scope.market) query = query.eq("market_id", scope.market.id);
  const { data: listings } = await query;
  const returnTo = withScope(scope, "/admin?tab=listings");

  if (!listings?.length) return <EmptyState title="No listings waiting for approval" />;

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {listings.map((l) => {
        const cover = [...l.listing_photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
        const market = marketsById.get(l.market_id)!;
        return (
          <li key={l.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
                {cover && <Image src={cover} alt="" fill sizes="96px" className="object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/listings/${l.id}`} className="font-semibold hover:underline">
                    {l.street}
                  </Link>
                  <MarketBadge market={market} />
                </div>
                <p className="text-[14px] text-muted">
                  {locationLine(market, l.zip, l.city)} · {formatPrice(l.price)} · {Number(l.beds)} bd · {Number(l.baths)} ba
                  {l.hide_exact_address ? " · address hidden" : ""}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {l.profiles.email} · {l.listing_photos.length} photos · {dateFmt.format(new Date(l.created_at))}
                </p>
              </div>
            </div>
            <RowActions approve={approveListing} reject={rejectListing} idName="listing_id" id={l.id} returnTo={returnTo} reviewHref={`/admin/listings/${l.id}`} />
          </li>
        );
      })}
    </ul>
  );
}

const FUNNEL_STEPS = [
  { event: "form_start", label: "Started the form" },
  { event: "contact_saved", label: "Saved contact details" },
  { event: "address_done", label: "Entered an address" },
  { event: "photos_done", label: "Added photos" },
  { event: "submitted", label: "Submitted" },
  { event: "email_verified", label: "Confirmed email" },
] as const;

/** Rows read for the Funnel tab: plenty for 30 days at current volume, and a ceiling on page cost. */
const FUNNEL_ROW_CAP = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Seller listing funnel from funnel_events: how many sellers reached each step in the last 7 and 30 days. */
async function Funnel({ scope, source }: { scope: Scope; source: string }) {
  const since = daysBefore(30);
  let query = createAdminClient()
    .from("funnel_events")
    .select("event, source, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(FUNNEL_ROW_CAP);
  if (scope.market) query = query.eq("market_id", scope.market.id);
  const { data, error } = await query;
  if (error) return <EmptyState title="The funnel couldn't be loaded">{error.message}</EmptyState>;

  const rows = data ?? [];
  const sources = [...new Set(rows.map((r) => r.source))].sort();
  const filtered = source ? rows.filter((r) => r.source === source) : rows;
  const weekAgo = since.getTime() + 23 * DAY_MS;
  const count = (event: string, days: 7 | 30) => filtered.filter((r) => r.event === event && (days === 30 || Date.parse(r.created_at) >= weekAgo)).length;
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
  const link = (value: string) => withScope(scope, `/admin?tab=funnel${value ? `&source=${encodeURIComponent(value)}` : ""}`);

  return (
    <div className="space-y-6">
      <nav aria-label="Source filter" className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="mr-1 text-muted">Source</span>
        {["", ...sources].map((value) => (
          <Link
            key={value || "all"}
            href={link(value)}
            aria-current={source === value ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${source === value ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
          >
            {value || "All sources"}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <thead className="bg-surface text-[13px] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Step</th>
              <th className="px-4 py-3 text-right font-medium">Last 7 days</th>
              <th className="px-4 py-3 text-right font-medium">Last 30 days</th>
              <th className="px-4 py-3 text-right font-medium">Of starts (30 days)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {FUNNEL_STEPS.map((step) => (
              <tr key={step.event}>
                <td className="px-4 py-3">
                  {step.label} <span className="text-[13px] text-muted">({step.event})</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{count(step.event, 7).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{count(step.event, 30).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(count(step.event, 30), count("form_start", 30))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted">
        Counts events, not unique people. Steps after a draft exists count once per draft; &ldquo;Started the form&rdquo; counts once per page visit.
        {rows.length >= FUNNEL_ROW_CAP ? ` Only the latest ${FUNNEL_ROW_CAP.toLocaleString("en-US")} events are counted.` : ""}
      </p>
    </div>
  );
}

const DRAFTS_PREVIEW = 200;
const draftStepLabels: Record<string, string> = {
  contact: "Contact details",
  address: "Address",
  details: "Home details",
  photos: "Photos",
  submitted: "Submitted",
};

/** Started more than a day ago and still not submitted. */
const isAbandonedDraft = (d: { status: string; created_at: string }) => d.status === "draft" && Date.parse(d.created_at) < Date.now() - 24 * 60 * 60 * 1000;

/** Unverified listing drafts: sellers who started /sell without an account. A lead list, newest first. */
async function Drafts({ scope, marketsById }: TabProps) {
  let query = createAdminClient()
    .from("listing_drafts")
    .select("id, full_name, email, phone, zip, step, status, source, created_at, reminder_sent_at, market_id")
    .neq("status", "verified")
    .order("created_at", { ascending: false })
    .limit(DRAFTS_PREVIEW);
  if (scope.market) query = query.eq("market_id", scope.market.id);
  const { data: drafts } = await query;

  if (!drafts?.length) return <EmptyState title="No unverified drafts" />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[760px] text-left text-[14px]">
        <thead className="bg-surface text-[13px] text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">ZIP</th>
            <th className="px-4 py-3 font-medium">Step reached</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {drafts.map((d) => {
            const market = marketsById.get(d.market_id);
            const abandoned = isAbandonedDraft(d);
            return (
              <tr key={d.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.full_name}</span>
                    <MarketBadge market={market} />
                  </div>
                  {d.source && <p className="text-[13px] text-muted">Source: {d.source}</p>}
                </td>
                <td className="break-all px-4 py-3">
                  <a href={`mailto:${d.email}`} className="hover:underline">
                    {d.email}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{d.phone ? formatUsPhone(d.phone) : "—"}</td>
                <td className="px-4 py-3">{d.zip && market ? `${d.zip} · ${areaForZip(market, d.zip)}` : d.zip ?? "—"}</td>
                <td className="px-4 py-3">
                  {draftStepLabels[d.step] ?? d.step}
                  <p className="text-[13px] text-muted">
                    {d.status === "pending_verification" ? "Waiting on email confirmation" : abandoned ? `Abandoned${d.reminder_sent_at ? " · reminder sent" : ""}` : "In progress"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{dateFmt.format(new Date(d.created_at))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const statusStyles: Record<VendorStatusFilter, string> = {
  pending: "bg-warm/15 text-ink",
  approved: "bg-forest/10 text-forest",
  rejected: "bg-red-50 text-red-800",
};

/** Every vendor in the market filter, newest first, with search by business name and a status filter. */
async function AllVendors({ scope, marketsById, page, query, status }: TabProps & { page: number; query: string; status?: VendorStatusFilter }) {
  let request = createAdminClient()
    .from("vendors")
    .select("id, business_name, category, status, created_at, market_id, vendor_verifications(verified_at)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * VENDORS_PAGE_SIZE, page * VENDORS_PAGE_SIZE - 1);
  if (scope.market) request = request.eq("market_id", scope.market.id);
  if (status) request = request.eq("status", status);
  // Partial, case-insensitive match; % and _ typed in the box are matched literally.
  if (query) request = request.ilike("business_name", `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, count, error } = await request;
  if (error) return <EmptyState title="Vendors couldn't be loaded">{error.message}</EmptyState>;

  const vendors = data ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE));
  const href = ({ p = 1, s = status, q = query }: { p?: number; s?: VendorStatusFilter; q?: string }) =>
    withScope(scope, `/admin?tab=all-vendors${s ? `&status=${s}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${p > 1 ? `&page=${p}` : ""}`);
  const verifiedAt = (v: (typeof vendors)[number]) => {
    const rel = v.vendor_verifications as { verified_at: string | null } | { verified_at: string | null }[] | null;
    return (Array.isArray(rel) ? rel[0] : rel)?.verified_at ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/admin" method="get" role="search" className="flex w-full max-w-md gap-2">
          <input type="hidden" name="tab" value="all-vendors" />
          <input type="hidden" name="market" value={scope.param} />
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="vendor-search" className="sr-only">
            Search by business name
          </label>
          <input
            id="vendor-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by business name"
            maxLength={100}
            className="min-h-11 w-full rounded-lg border border-ink/20 px-3 text-[15px] focus:border-forest focus:outline-none"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-lg border border-ink/20 px-4 text-[15px] font-medium hover:border-forest">
            Search
          </button>
        </form>
        <nav aria-label="Status filter" className="flex flex-wrap items-center gap-2 text-[14px]">
          {[undefined, ...VENDOR_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={href({ s })}
              aria-current={status === s ? "page" : undefined}
              className={`rounded-full border px-3 py-1 capitalize ${status === s ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
            >
              {s ?? "All"}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-[14px] text-muted">
        {total.toLocaleString("en-US")} {total === 1 ? "vendor" : "vendors"}
        {query ? ` matching “${query}”` : ""}
        {query && (
          <>
            {" · "}
            <Link href={href({ q: "" })} className="font-medium text-forest underline underline-offset-2">
              Clear search
            </Link>
          </>
        )}
      </p>

      {vendors.length === 0 ? (
        <EmptyState title={query || status ? "No vendors match" : "No vendors yet"} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead className="bg-surface text-[13px] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/vendors/${v.id}`} className="font-semibold text-forest hover:underline">
                        {v.business_name}
                      </Link>
                      <MarketBadge market={marketsById.get(v.market_id)} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{categoryByValue(v.category).singular}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-medium capitalize ${statusStyles[v.status]}`}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3">{verifiedAt(v) ? "Yes" : "No"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFmt.format(new Date(v.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Vendor pages" className="flex items-center justify-between text-[15px]">
          {page > 1 ? (
            <Link href={href({ p: page - 1 })} className="font-medium text-forest underline underline-offset-2">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ p: page + 1 })} className="font-medium text-forest underline underline-offset-2">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

async function AllLeads({ scope, marketsById, page, type }: TabProps & { page: number; type?: Lead["type"] }) {
  let query = createAdminClient()
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * LEADS_PAGE_SIZE, page * LEADS_PAGE_SIZE - 1);
  if (type) query = query.eq("type", type);
  if (scope.market) query = query.eq("market_id", scope.market.id);
  const { data, count } = await query;
  const leads = await attachLeadTargets(data ?? []);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const href = (p: number, t = type) => withScope(scope, `/admin?tab=leads${t ? `&type=${t}` : ""}${p > 1 ? `&page=${p}` : ""}`);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        {[
          { key: undefined, label: "All" },
          { key: "listing" as const, label: "Listings" },
          { key: "interest" as const, label: "Interest" },
          { key: "vendor" as const, label: "Vendors" },
        ].map((f) => (
          <Link
            key={f.label}
            href={href(1, f.key)}
            aria-current={type === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${type === f.key ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto text-muted">{total.toLocaleString("en-US")} total</span>
      </div>

      {leads.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No leads yet" />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {leads.map((lead) => (
            <li key={lead.id} className="p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="min-w-0 break-words font-semibold">
                  <MarketBadge market={marketsById.get(lead.market_id)} />{" "}
                  {lead.sender_name}
                  <span className="font-normal text-muted"> to </span>
                  <Link href={lead.targetHref} className="font-medium text-forest hover:underline">
                    {lead.targetLabel}
                  </Link>
                </p>
                <time dateTime={lead.created_at} className="shrink-0 text-[13px] text-muted">
                  {dateFmt.format(new Date(lead.created_at))}
                </time>
              </div>
              {(() => {
                const details = readInterestDetails(lead.details);
                return details ? (
                  <p className="mt-1 text-[15px]">
                    {interestRows(details)
                      .map(([label, value]) => `${label}: ${value}`)
                      .join(" · ")}
                  </p>
                ) : null;
              })()}
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{lead.message}</p>
              <p className="mt-2 break-words text-[13px] text-muted">
                {leadKindLabel(lead.type)} · from {lead.sender_email}
                {lead.sender_phone ? ` · ${formatUsPhone(lead.sender_phone)}` : ""}
                {lead.recipientEmail ? ` · sent to ${lead.recipientEmail}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Lead pages" className="mt-6 flex items-center justify-between text-[15px]">
          {page > 1 ? (
            <Link href={href(page - 1)} className="font-medium text-forest underline underline-offset-2">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className="font-medium text-forest underline underline-offset-2">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

async function Buyers({ scope, marketsById }: TabProps) {
  const admin = createAdminClient();
  const scopedTo = <Q extends { eq: (column: string, value: string) => Q }>(query: Q, column = "market_id") =>
    scope.market ? query.eq(column, scope.market.id) : query;

  const [accounts, alerts, accountTotal, alertTotal] = await Promise.all([
    scopedTo(
      admin
        .from("profiles")
        .select("id, full_name, email, phone, market_id, created_at")
        .contains("roles", ["buyer"])
        .order("created_at", { ascending: false })
        .limit(BUYERS_PREVIEW),
    ),
    scopedTo(
      admin
        .from("listing_alerts")
        .select("id, email, zip, market_id, created_at, unsubscribed_at")
        .order("created_at", { ascending: false })
        .limit(BUYERS_PREVIEW),
    ),
    scopedTo(admin.from("profiles").select("id", { count: "exact", head: true }).contains("roles", ["buyer"])),
    scopedTo(admin.from("listing_alerts").select("id", { count: "exact", head: true }).is("unsubscribed_at", null)),
  ]);

  const accountRows = accounts.data ?? [];
  const alertRows = alerts.data ?? [];

  return (
    <div className="space-y-10">
      <dl className="grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface p-4">
          <dt className="text-[14px] text-muted">Buyer accounts</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">{(accountTotal.count ?? 0).toLocaleString("en-US")}</dd>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <dt className="text-[14px] text-muted">Active alert signups</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">{(alertTotal.count ?? 0).toLocaleString("en-US")}</dd>
        </div>
      </dl>

      <section aria-labelledby="buyer-accounts">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="buyer-accounts" className="text-xl font-semibold tracking-tight">
            Buyer accounts <span className="text-muted">({(accountTotal.count ?? 0).toLocaleString("en-US")})</span>
          </h2>
          <a href={withScope(scope, "/admin/export/buyers.csv")} className="text-[15px] font-medium text-forest underline underline-offset-2">
            Export all (CSV)
          </a>
        </div>
        <p className="mt-1 text-[14px] text-muted">
          Anyone who picked &ldquo;Buyer&rdquo; when they set up their account. Market is the site they signed up on; accounts
          created before we recorded it show no market.
        </p>
        {accountRows.length ? (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {accountRows.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.full_name ?? "No name yet"}
                    {p.market_id && <MarketBadge market={marketsById.get(p.market_id)} />}
                  </p>
                  <p className="break-words text-[14px] text-muted">
                    {p.email}
                    {p.phone ? ` · ${formatUsPhone(p.phone)}` : ""}
                  </p>
                </div>
                <time dateTime={p.created_at} className="shrink-0 text-[13px] text-muted">
                  {dateFmt.format(new Date(p.created_at))}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No buyer accounts yet" />
          </div>
        )}
        {accountRows.length >= BUYERS_PREVIEW && (
          <p className="mt-3 text-[13px] text-muted">Showing the {BUYERS_PREVIEW} most recent. Export the CSV for all of them.</p>
        )}
      </section>

      <section aria-labelledby="alert-signups">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="alert-signups" className="text-xl font-semibold tracking-tight">
            Listing alert signups <span className="text-muted">({(alertTotal.count ?? 0).toLocaleString("en-US")} active)</span>
          </h2>
          <a href={withScope(scope, "/admin/export/alerts.csv")} className="text-[15px] font-medium text-forest underline underline-offset-2">
            Export all (CSV)
          </a>
        </div>
        <p className="mt-1 text-[14px] text-muted">Email-only signups from the buyer alert forms. No account needed.</p>
        {alertRows.length ? (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {alertRows.map((a) => {
              const market = marketsById.get(a.market_id);
              return (
                <li key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 break-words font-medium">
                      <MarketBadge market={market} />
                      {a.email}
                      {a.unsubscribed_at && <span className="rounded-full bg-surface px-2 py-0.5 text-[12px] text-muted">Unsubscribed</span>}
                    </p>
                    <p className="text-[14px] text-muted">
                      {a.zip && market ? `${a.zip} · ${areaForZip(market, a.zip)}` : "Every area"}
                    </p>
                  </div>
                  <time dateTime={a.created_at} className="shrink-0 text-[13px] text-muted">
                    {dateFmt.format(new Date(a.created_at))}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No alert signups yet" />
          </div>
        )}
        {alertRows.length >= BUYERS_PREVIEW && (
          <p className="mt-3 text-[13px] text-muted">Showing the {BUYERS_PREVIEW} most recent. Export the CSV for all of them.</p>
        )}
      </section>
    </div>
  );
}

function RowActions({
  approve,
  reject,
  idName,
  id,
  returnTo,
  reviewHref,
}: {
  approve: (formData: FormData) => Promise<void>;
  reject: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  returnTo: string;
  reviewHref: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <form action={approve}>
        <input type="hidden" name={idName} value={id} />
        <input type="hidden" name="return_to" value={returnTo} />
        <SubmitButton pendingLabel="Approving">Approve</SubmitButton>
      </form>
      <form action={reject}>
        <input type="hidden" name={idName} value={id} />
        <input type="hidden" name="return_to" value={returnTo} />
        <SubmitButton variant="secondary" pendingLabel="Rejecting">
          Reject
        </SubmitButton>
      </form>
      <Link href={reviewHref} className="text-[15px] font-medium text-forest underline underline-offset-2">
        Review
      </Link>
    </div>
  );
}

function Markets({ markets, returnTo }: { markets: Market[]; returnTo: string }) {
  return (
    <div>
      <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
        Coming-soon markets show a launch page with listing alerts and vendor pre-registration. Going live opens listings, the
        vendor directory (with every approved pre-launch vendor), guides, and the market switcher. See SETUP.md before launching.
      </p>
      <ul className="mt-6 divide-y divide-line rounded-2xl border border-line">
        {markets.map((m) => {
          const live = isLive(m);
          return (
            <li key={m.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{brandName(m)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider ${live ? "bg-forest text-white" : "bg-warm/15 text-ink"}`}>
                    {live ? "Live" : "Coming soon"}
                  </span>
                </p>
                <p className="mt-1 text-[14px] text-muted">
                  {m.region}, {m.state_code} · {m.domain} · sends from {m.sender_email}
                </p>
                <p className="text-[14px] text-muted">{m.counties.join(", ")} counties</p>
              </div>
              <form action={setMarketStatus} className="flex shrink-0 flex-col gap-2 sm:items-end">
                <input type="hidden" name="market_id" value={m.id} />
                <input type="hidden" name="status" value={live ? "coming_soon" : "live"} />
                <input type="hidden" name="return_to" value={returnTo} />
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" name="confirm" required className="h-4 w-4 accent-[#1f4d3a]" />
                  {live ? `Yes, hide ${brandName(m)} listings` : `Yes, launch ${brandName(m)}`}
                </label>
                <SubmitButton variant={live ? "secondary" : "forest"} pendingLabel="Saving">
                  {live ? "Set back to coming soon" : "Flip to live"}
                </SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
