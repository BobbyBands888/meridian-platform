import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, EmptyState } from "@/components/ui";
import { locationLine } from "@/lib/areas";
import { requireAdmin } from "@/lib/auth";
import type { Lead } from "@/lib/database.types";
import { attachLeadTargets } from "@/lib/leads";
import { formatPrice } from "@/lib/listings";
import { formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";
import { approveListing, approveVendor, approveVendorEdit, rejectListing, rejectVendor } from "./actions";
import { SubmitButton } from "./submit-button";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

const TABS = [
  { key: "vendors", label: "Pending Vendors" },
  { key: "listings", label: "Pending Listings" },
  { key: "leads", label: "All Leads" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const LEADS_PAGE_SIZE = 50;

const notices: Record<string, string> = {
  approved: "Approved, and the email was sent.",
  rejected: "Rejected, and the email was sent.",
  "edit-approved": "Edit approved. The changes are live and the vendor was emailed.",
  already: "That was already handled, so no email was sent again.",
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin("/admin");
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "vendors";
  const page = Math.max(1, Number(params.page) || 1);
  const leadType = params.type === "vendor" || params.type === "listing" ? params.type : undefined;
  const notice = notices[String(params.done ?? "")];

  const admin = createAdminClient();
  const [vendorsCount, editsCount, listingsCount, leadsCount, alertsActive, alertsTotal] = await Promise.all([
    admin.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("vendor_pending_edits").select("vendor_id", { count: "exact", head: true }),
    admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("leads").select("id", { count: "exact", head: true }),
    admin.from("listing_alerts").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    admin.from("listing_alerts").select("id", { count: "exact", head: true }),
  ]);
  const alertSubscribers = alertsActive.count ?? 0;
  const alertUnsubscribed = (alertsTotal.count ?? 0) - alertSubscribers;
  const counts: Record<Tab, number> = {
    vendors: (vendorsCount.count ?? 0) + (editsCount.count ?? 0),
    listings: listingsCount.count ?? 0,
    leads: leadsCount.count ?? 0,
  };

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Admin</h1>
          <p className="mt-2 text-[15px] text-muted">
            Listing alert signups: <strong className="font-semibold text-ink">{alertSubscribers.toLocaleString("en-US")}</strong> active
            {alertUnsubscribed > 0 ? ` · ${alertUnsubscribed.toLocaleString("en-US")} unsubscribed` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[15px]">
          <a href="/admin/export/vendors.csv" className="font-medium text-forest underline underline-offset-2">
            Export vendors (CSV)
          </a>
          <a href="/admin/export/leads.csv" className="font-medium text-forest underline underline-offset-2">
            Export leads (CSV)
          </a>
          <a href="/admin/export/alerts.csv" className="font-medium text-forest underline underline-offset-2">
            Export listing alerts (CSV)
          </a>
        </div>
      </div>

      <nav aria-label="Admin sections" className="-mx-4 mt-8 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-6 whitespace-nowrap">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin?tab=${t.key}`}
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
        {tab === "vendors" && <PendingVendors />}
        {tab === "listings" && <PendingListings />}
        {tab === "leads" && <AllLeads page={page} type={leadType} />}
      </div>
    </Container>
  );
}

async function PendingVendors() {
  const admin = createAdminClient();
  const [{ data: vendors }, { data: edits }] = await Promise.all([
    admin
      .from("vendors")
      .select("id, business_name, category, headshot_url, service_area, created_at, profiles!inner(email, phone)")
      .eq("status", "pending")
      .order("created_at"),
    admin
      .from("vendor_pending_edits")
      .select("vendor_id, business_name, category, headshot_url, submitted_at, vendors!inner(business_name, category)")
      .order("submitted_at"),
  ]);
  const returnTo = "/admin?tab=vendors";

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
                    <Link href={`/admin/vendors/${v.id}`} className="font-semibold hover:underline">
                      {v.business_name}
                    </Link>
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
                    <Link href={`/admin/vendors/${e.vendor_id}`} className="font-semibold hover:underline">
                      {e.business_name}
                    </Link>
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

async function PendingListings() {
  const { data: listings } = await createAdminClient()
    .from("listings")
    .select("id, street, city, zip, price, beds, baths, hide_exact_address, created_at, profiles!inner(email), listing_photos(url, sort_order)")
    .eq("status", "pending")
    .order("created_at");
  const returnTo = "/admin?tab=listings";

  if (!listings?.length) return <EmptyState title="No listings waiting for approval" />;

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {listings.map((l) => {
        const cover = [...l.listing_photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
        return (
          <li key={l.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
                {cover && <Image src={cover} alt="" fill sizes="96px" className="object-cover" />}
              </div>
              <div className="min-w-0">
                <Link href={`/admin/listings/${l.id}`} className="font-semibold hover:underline">
                  {l.street}
                </Link>
                <p className="text-[14px] text-muted">
                  {locationLine(l.zip, l.city)} · {formatPrice(l.price)} · {Number(l.beds)} bd · {Number(l.baths)} ba
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

async function AllLeads({ page, type }: { page: number; type?: Lead["type"] }) {
  let query = createAdminClient()
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * LEADS_PAGE_SIZE, page * LEADS_PAGE_SIZE - 1);
  if (type) query = query.eq("type", type);
  const { data, count } = await query;
  const leads = await attachLeadTargets(data ?? []);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const href = (p: number, t = type) => `/admin?tab=leads${t ? `&type=${t}` : ""}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        {[
          { key: undefined, label: "All" },
          { key: "listing" as const, label: "Listings" },
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
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{lead.message}</p>
              <p className="mt-2 break-words text-[13px] text-muted">
                {lead.type === "vendor" ? "Vendor" : "Listing"} inquiry · from {lead.sender_email}
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
