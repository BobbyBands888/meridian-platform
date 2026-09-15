import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { checkFairHousing } from "@/lib/fair-housing";
import { locationLine } from "@/lib/areas";
import { formatPrice, formatSpecs, listingPath, statusLabels } from "@/lib/listings";
import { formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveListing, rejectListing } from "../../actions";
import { SubmitButton } from "../../submit-button";

export const metadata: Metadata = {
  title: "Review listing",
  robots: { index: false },
};

const done: Record<string, string> = {
  approved: "Approved. The listing is live and the seller was emailed.",
  rejected: "Rejected. The seller was emailed.",
  already: "That was already handled, so no email was sent again.",
};

export default async function AdminListingPage({ params, searchParams }: PageProps<"/admin/listings/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/listings/${id}`);
  const notice = done[String((await searchParams).done ?? "")];

  const { data: listing } = await createAdminClient()
    .from("listings")
    .select("*, profiles!inner(email, phone, full_name), listing_photos(id, url, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  const photos = [...listing.listing_photos].sort((a, b) => a.sort_order - b.sort_order);
  const issues = checkFairHousing(listing.description);
  const published = ["active", "under_contract", "sold"].includes(listing.status);

  return (
    <Container className="py-12 sm:py-16">
      <Link href="/admin" className="text-[15px] font-medium text-forest hover:underline">
        ← Admin
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] text-muted">
            Status: <span className="font-semibold text-ink">{statusLabels[listing.status]}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{listing.street}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {locationLine(listing.zip, listing.city)} · {formatPrice(listing.price)} · {formatSpecs(listing)}
          </p>
        </div>
        {published && (
          <ButtonLink href={listingPath(listing)} variant="secondary">
            View public listing
          </ButtonLink>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-forest/20 bg-forest/[0.04] px-4 py-3 text-[15px]">
          {notice}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <section aria-labelledby="photos-heading">
            <h2 id="photos-heading" className="text-lg font-semibold">
              Photos ({photos.length})
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface">
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    <Image src={p.url} alt={`Photo ${i + 1}`} fill sizes="200px" className="object-cover" />
                  </a>
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-white/95 px-1.5 text-[11px] font-semibold">Cover</span>}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-lg font-semibold">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-[16px] leading-relaxed">{listing.description}</p>
            <div className="mt-3">
              {issues.length === 0 ? (
                <Check label="No Fair Housing phrases found" />
              ) : (
                <p className="text-[15px] text-red-700">Fair Housing phrases: {issues.map((i) => `"${i.phrase}"`).join(", ")}</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="seller-heading" className="rounded-2xl border border-line p-5">
            <h2 id="seller-heading" className="text-lg font-semibold">
              Seller
            </h2>
            <dl className="mt-3 space-y-1.5 text-[15px]">
              <div>{listing.profiles.full_name}</div>
              <div className="break-all">{listing.profiles.email}</div>
              <div>{formatUsPhone(listing.profiles.phone)}</div>
              <div className="pt-2 text-muted">Exact address {listing.hide_exact_address ? "hidden from buyers" : "shown publicly"}</div>
            </dl>
          </section>

          <section aria-labelledby="decision-heading" className="rounded-2xl border border-line p-5">
            <h2 id="decision-heading" className="text-lg font-semibold">
              Decision
            </h2>
            <div className="mt-4 space-y-5">
              {listing.status === "pending" || listing.status === "rejected" ? (
                <form action={approveListing}>
                  <input type="hidden" name="listing_id" value={listing.id} />
                  <SubmitButton pendingLabel="Approving">Approve listing</SubmitButton>
                </form>
              ) : null}
              {listing.status !== "rejected" && (
                <form action={rejectListing} className="space-y-3">
                  <input type="hidden" name="listing_id" value={listing.id} />
                  <label htmlFor="reject-note" className="block text-[14px] font-medium">
                    Note to seller (optional)
                  </label>
                  <textarea id="reject-note" name="note" rows={3} maxLength={2000} className="w-full rounded-lg border border-ink/20 px-3 py-2 text-[15px] focus:border-forest focus:outline-none" />
                  <SubmitButton variant="secondary" pendingLabel="Rejecting">
                    {published ? "Take listing down" : "Reject listing"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>
        </aside>
      </div>
    </Container>
  );
}
