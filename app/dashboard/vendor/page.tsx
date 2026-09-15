import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categoryByValue, vendorPath } from "@/lib/vendors";

export const metadata: Metadata = {
  title: "Vendor dashboard",
  robots: { index: false },
};

const notices: Record<string, string> = {
  submitted: "Received — you'll be live within 24 hours. We sent a confirmation to your email.",
  saved: "Your changes were saved.",
  "edit-pending": "Your changes to your business name, bio, or headshot were sent for review. Your current profile stays live until they're approved.",
  resubmitted: "Your updated profile was resubmitted for review.",
};

export default async function VendorDashboardPage({ searchParams }: PageProps<"/dashboard/vendor">) {
  const profile = await requireProfile("/dashboard/vendor");
  const params = await searchParams;
  const notice = Object.keys(notices).find((key) => params[key] === "1");

  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!vendor) redirect("/vendors/join");
  const { data: pending } = await supabase.from("vendor_pending_edits").select("*").eq("vendor_id", vendor.id).maybeSingle();

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

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
              <ProfileSummary vendor={{ ...vendor, ...pending }} categoryLabel={category.singular} compact />
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
