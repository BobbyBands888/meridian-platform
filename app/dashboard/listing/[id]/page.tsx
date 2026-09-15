import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { ListingStatus } from "@/lib/database.types";
import { formatPrice, listingPath, statusLabels } from "@/lib/listings";
import { locationLine } from "@/lib/areas";
import { formatUsPhone } from "@/lib/phone";
import { getInquiries, getInquiryCounts } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { updateListing } from "@/app/sell/actions";
import { ListingForm } from "@/app/sell/listing-form";

export const metadata: Metadata = {
  title: "Manage listing",
  robots: { index: false },
};

const PUBLISHED: ListingStatus[] = ["active", "under_contract", "sold"];
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function ManageListingPage({ params }: PageProps<"/dashboard/listing/[id]">) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/listing/${id}`);
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*, listing_photos(url, sort_order)")
    .eq("id", id)
    .eq("seller_id", profile.id)
    .maybeSingle();
  if (!listing) notFound();

  // Row-level security limits these to inquiries about the seller's own listing.
  const [leads, counts] = await Promise.all([getInquiries("listing", listing.id), getInquiryCounts("listing", listing.id)]);

  const photos = [...listing.listing_photos].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.url);
  const published = PUBLISHED.includes(listing.status);

  return (
    <Container className="py-12 sm:py-16">
      <Link href="/dashboard" className="text-[15px] font-medium text-forest hover:underline">
        ← Your account
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] text-muted">
            Status: <span className="font-semibold text-ink">{statusLabels[listing.status]}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{listing.street}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {locationLine(listing.zip, listing.city)} · {formatPrice(listing.price)}
          </p>
        </div>
        {published && (
          <ButtonLink href={listingPath(listing)} variant="secondary">
            View public listing
          </ButtonLink>
        )}
      </div>

      {listing.status === "pending" && (
        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[15px]">
          Your listing is in review. We&apos;ll email you when it&apos;s live, usually within 24 hours. You can still make changes.
        </p>
      )}
      {listing.status === "rejected" && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">
          This listing wasn&apos;t approved. Check your email for details, or reply to that email with questions.
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="text-2xl font-semibold tracking-tight">
            Edit listing
          </h2>
          <div className="mt-6">
            <ListingForm
              mode="edit"
              userId={profile.id}
              listingId={listing.id}
              action={updateListing}
              submitLabel="Save changes"
              statusOptions={published ? PUBLISHED : []}
              initial={{
                street: listing.street,
                zip: listing.zip,
                hide_exact_address: listing.hide_exact_address,
                price: String(listing.price),
                beds: String(listing.beds),
                baths: String(listing.baths),
                sqft: String(listing.sqft ?? ""),
                description: listing.description,
                photo_urls: photos,
                status: listing.status,
              }}
            />
          </div>
        </section>

        <section aria-labelledby="inquiries-heading" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line p-6">
            <h2 id="inquiries-heading" className="text-2xl font-semibold tracking-tight">
              Inquiries <span className="text-muted">({counts.allTime})</span>
            </h2>
            {counts.allTime > 0 && <p className="mt-1 text-[14px] text-muted">{counts.last30Days} in the last 30 days</p>}
            {leads.length ? (
              <ul className="mt-4 space-y-4">
                {leads.map((lead) => (
                  <li key={lead.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 break-words font-semibold">{lead.sender_name}</p>
                      <time dateTime={lead.created_at} className="shrink-0 text-[13px] text-muted">
                        {dateFmt.format(new Date(lead.created_at))}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{lead.message}</p>
                    <p className="mt-2 text-[14px]">
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
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                {published ? "No inquiries yet. Buyers' messages will appear here and arrive by email." : "Inquiries will appear here once your listing is live."}
              </p>
            )}
          </div>
        </section>
      </div>
    </Container>
  );
}
