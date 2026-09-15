import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { getInquiries, getInquiryCounts } from "@/lib/leads";
import { formatUsPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { categoryByValue, vendorPath } from "@/lib/vendors";

export const metadata: Metadata = {
  title: "Vendor dashboard",
  robots: { index: false },
};

const inquiryDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const notices: Record<string, string> = {
  submitted: "Received — you'll be live within 24 hours. We sent a confirmation to your email.",
  saved: "Your changes were saved.",
  "edit-pending": "Your changes to your business name, category, bio, or headshot were sent for review. Your current profile stays live until they're approved.",
  resubmitted: "Your updated profile was resubmitted for review.",
};

export default async function VendorDashboardPage({ searchParams }: PageProps<"/dashboard/vendor">) {
  const profile = await requireProfile("/dashboard/vendor");
  const params = await searchParams;
  const notice = Object.keys(notices).find((key) => params[key] === "1");

  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!vendor) redirect("/vendors/join");
  const [{ data: pending }, counts, inquiries] = await Promise.all([
    supabase.from("vendor_pending_edits").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    getInquiryCounts("vendor", vendor.id),
    getInquiries("vendor", vendor.id),
  ]);

  const category = categoryByValue(vendor.category);

  return (
    <Container className="py-12 sm:py-16">
      <Link href="/dashboard" className="text-[15px] font-medium text-forest hover:underline">
        ← Your account
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">Vendor dashboard</h1>

      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px]">
          {notices[notice]}
        </p>
      )}

      <section aria-labelledby="inquiries-heading" className="mt-8 rounded-2xl border border-line p-6">
        <h2 id="inquiries-heading" className="text-2xl font-semibold tracking-tight">
          You&apos;ve received {counts.allTime.toLocaleString("en-US")} {counts.allTime === 1 ? "inquiry" : "inquiries"} through Nashville Buys.
        </h2>
        <dl className="mt-4 grid max-w-md grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-[14px] text-muted">All time</dt>
            <dd className="mt-1 text-3xl font-bold tracking-tight">{counts.allTime.toLocaleString("en-US")}</dd>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-[14px] text-muted">Last 30 days</dt>
            <dd className="mt-1 text-3xl font-bold tracking-tight">{counts.last30Days.toLocaleString("en-US")}</dd>
          </div>
        </dl>

        {inquiries.length > 0 ? (
          <ul className="mt-6 divide-y divide-line border-t border-line">
            {inquiries.map((lead) => (
              <li key={lead.id} className="py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <p className="min-w-0 break-words font-semibold">{lead.sender_name}</p>
                  <time dateTime={lead.created_at} className="shrink-0 text-[13px] text-muted">
                    {inquiryDate.format(new Date(lead.created_at))}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{lead.message}</p>
                <p className="mt-2 break-words text-[14px]">
                  <a href={`mailto:${lead.sender_email}`} className="text-forest underline underline-offset-2">
                    {lead.sender_email}
                  </a>
                  {lead.sender_phone && (
                    <>
                      {" · "}
                      <a href={`tel:${lead.sender_phone}`} className="text-forest underline underline-offset-2">
                        {formatUsPhone(lead.sender_phone)}
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            {vendor.status === "approved"
              ? "No inquiries yet. When someone contacts you from your profile, it arrives by email and shows up here."
              : "Inquiries will show up here once your profile is live."}
          </p>
        )}
        {inquiries.length >= 100 && <p className="mt-3 text-[13px] text-muted">Showing your 100 most recent inquiries.</p>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="status-heading" className="rounded-2xl border border-line p-6">
          <h2 id="status-heading" className="text-lg font-semibold tracking-tight">
            Status
          </h2>
          {vendor.status === "approved" && (
            <>
              <p className="mt-3">
                <Check label="Live in the directory" />
              </p>
              <p className="mt-2 text-[15px] text-muted">Listed under {category.label}.</p>
              <ButtonLink href={vendorPath(vendor)} variant="secondary" className="mt-5 sm:w-full">
                View public profile
              </ButtonLink>
            </>
          )}
          {vendor.status === "pending" && (
            <p className="mt-3 text-[15px] leading-relaxed">
              <span className="font-medium">In review.</span> You&apos;ll get an email when your profile is live, usually
              within 24 hours.
            </p>
          )}
          {vendor.status === "rejected" && (
            <p className="mt-3 text-[15px] leading-relaxed">
              <span className="font-medium">Not approved.</span> Check your email for details, then update your profile to
              resubmit it.
            </p>
          )}
          {vendor.founding_vendor && (
            <p className="mt-5 border-t border-line pt-4 text-[14px] leading-relaxed text-muted">
              Free for founding vendors during our Nashville launch. When we introduce pricing, founding vendors get first
              notice and a locked-in rate.
            </p>
          )}
        </section>

        <section aria-labelledby="profile-heading" className="rounded-2xl border border-line p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 id="profile-heading" className="text-lg font-semibold tracking-tight">
              {vendor.status === "approved" ? "Live profile" : "Your profile"}
            </h2>
            <Link href="/dashboard/vendor/edit" className="text-[15px] font-medium text-forest hover:underline">
              Edit
            </Link>
          </div>
          <ProfileSummary vendor={vendor} categoryLabel={category.singular} />

          {pending && (
            <div className="mt-6 rounded-xl border border-dashed border-line p-5">
              <h3 className="font-semibold">Changes waiting for approval</h3>
              <p className="mt-1 text-[14px] text-muted">
                Submitted {new Date(pending.submitted_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Your live
                profile above stays up until these are approved.
              </p>
              <ProfileSummary vendor={{ ...vendor, ...pending }} categoryLabel={categoryByValue(pending.category).singular} compact />
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}

function ProfileSummary({
  vendor,
  categoryLabel,
  compact,
}: {
  vendor: { business_name: string; bio: string; headshot_url: string; service_area: string; price_range: string; website: string | null };
  categoryLabel: string;
  compact?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col gap-5 sm:flex-row">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-surface">
        <Image src={vendor.headshot_url} alt="" fill sizes="112px" className="object-cover object-top" />
      </div>
      <div className="min-w-0 text-[15px]">
        <p className="text-[13px] font-medium text-forest">{categoryLabel}</p>
        <p className="text-lg font-semibold">{vendor.business_name}</p>
        <p className="mt-1 leading-relaxed text-muted">{vendor.bio}</p>
        {!compact && (
          <dl className="mt-3 space-y-1">
            <div className="flex gap-2">
              <dt className="text-muted">Serves</dt>
              <dd>{vendor.service_area}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Pricing</dt>
              <dd>{vendor.price_range}</dd>
            </div>
            {vendor.website && (
              <div className="flex gap-2">
                <dt className="text-muted">Website</dt>
                <dd className="break-all">{vendor.website}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
