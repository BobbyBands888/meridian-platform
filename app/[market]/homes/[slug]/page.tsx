import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaBySlug } from "@/lib/areas";
import { ListingContact } from "@/components/listing-contact";
import { CardGrid } from "@/components/photo-card";
import { VendorCard } from "@/components/vendor-card";
import { Check } from "@/components/photo-card";
import { Container } from "@/components/ui";
import { getDisclosureGuidePath } from "@/lib/guides";
import { formatPrice, formatSpecs, listingLocation, listingPath, listingSummary, statusLabels } from "@/lib/listings";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { getPublicListing } from "@/lib/public-listings";
import { closeDateRange } from "@/lib/interest";
import { getVendorsInCategory } from "@/lib/public-vendors";
import { AreaPage, areaMetadata } from "./area-page";
import { ListingGallery } from "./listing-gallery";

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[market]/homes/[slug]">): Promise<Metadata> {
  const { market: marketSlug, slug } = await params;
  const market = await requireMarket(marketSlug);
  const area = areaBySlug(market, slug);
  if (area) return areaMetadata(market, area);
  const result = await getPublicListing(market.id, slug);
  if (!result) return {};
  const { listing, photos } = result;
  const location = listingLocation(market, listing);
  // Hidden-address headlines already name the area ("Home in Mt. Juliet"), so only add the city to street addresses.
  const title = `${formatPrice(listing.price)} · ${listing.hide_exact_address ? location.headline : `${location.headline}, ${listing.city}`}`;
  const description = `${listingSummary(market, listing)}. ${formatSpecs(listing)}. ${listing.description}`.slice(0, 200);
  const images = photos.slice(0, 1).map((p) => ({ url: p.url, alt: `Photo of ${location.headline}` }));
  return {
    title,
    description,
    alternates: { canonical: listingPath(listing) },
    robots: listing.status === "sold" ? { index: false } : undefined,
    openGraph: { type: "website", title, description, url: listingPath(listing), siteName: brandName(market), images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/**
 * One segment serves two kinds of page: a neighborhood ("east-nashville") and a listing. Area slugs win, and they
 * can't collide: every listing slug ends in its five-digit ZIP, which no area name does.
 */
export default async function ListingPage({ params }: PageProps<"/[market]/homes/[slug]">) {
  const { market: marketSlug, slug } = await params;
  const market = await requireMarket(marketSlug);
  const area = areaBySlug(market, slug);
  if (area) return <AreaPage market={market} area={area} />;

  const [result, disclosureGuide, lenders] = await Promise.all([
    getPublicListing(market.id, slug),
    getDisclosureGuidePath(market.slug),
    // For a buyer who says they aren't pre-approved yet, on the interest form's confirmation.
    getVendorsInCategory(market.id, "lender", 2).catch(() => []),
  ]);
  if (!result) notFound(); // The layout already 404s; this narrows the type.
  const { listing, photos } = result;
  const location = listingLocation(market, listing);
  const isActive = listing.status === "active";
  const closeRange = closeDateRange();

  return (
    <Container className="py-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link href="/homes" className="hover:text-ink">
          Homes for sale
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{location.area}</span>
      </nav>

      <div className="mt-4">
        <ListingGallery photos={photos} alt={`Photo of ${location.headline}`} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <article>
          {!isActive && (
            <p className="mb-3 inline-block rounded-md border border-line px-2.5 py-1 text-[14px] font-semibold">{statusLabels[listing.status]}</p>
          )}
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{formatPrice(listing.price)}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{location.headline}</h1>
          <p className="mt-1 text-[17px] text-muted">{location.area}</p>

          <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line text-center">
            <div className="p-4">
              <dt className="text-[13px] text-muted">Beds</dt>
              <dd className="mt-0.5 text-xl font-semibold">{Number(listing.beds)}</dd>
            </div>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Baths</dt>
              <dd className="mt-0.5 text-xl font-semibold">{Number(listing.baths)}</dd>
            </div>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Sq ft</dt>
              <dd className="mt-0.5 text-xl font-semibold">{listing.sqft ? listing.sqft.toLocaleString("en-US") : "—"}</dd>
            </div>
          </dl>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Check label="For sale by owner" />
            </li>
            <li>
              <Check label="Reviewed before publishing" />
            </li>
          </ul>

          <h2 className="mt-10 text-xl font-semibold tracking-tight">About this home</h2>
          <p className="mt-3 whitespace-pre-line text-[17px] leading-[1.75]">{listing.description}</p>

          {listing.hide_exact_address && (
            <p className="mt-6 text-[15px] text-muted">The seller shares the exact address with interested buyers directly.</p>
          )}

          <div className="mt-10 space-y-3 rounded-2xl bg-surface p-5 text-[14px] leading-relaxed text-muted">
            <p>
              Listings are submitted by owners. {brandName(market)} reviews listings before publishing but doesn&apos;t verify the
              price, description, or condition. Verify everything independently and hire your own inspector and real estate
              attorney.
            </p>
            <p>
              {market.disclosure_note}
              {disclosureGuide && (
                <>
                  {" "}
                  <Link href={disclosureGuide} className="font-medium text-forest underline underline-offset-2">
                    Learn what it covers
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </article>

        <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line p-6">
            <h2 id="contact-heading" className="text-2xl font-semibold tracking-tight">
              {isActive ? "Contact the seller" : `This home is ${statusLabels[listing.status].toLowerCase()}`}
            </h2>
            {isActive ? (
              <div className="mt-5">
                <ListingContact
                  listingId={listing.id}
                  brand={brandName(market)}
                  closeRange={closeRange}
                  lenderCards={
                    lenders.length > 0 ? (
                      <CardGrid>
                        {lenders.map((vendor) => (
                          <VendorCard key={vendor.id} market={market} vendor={vendor} />
                        ))}
                      </CardGrid>
                    ) : null
                  }
                />
              </div>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                The seller isn&apos;t taking new inquiries.{" "}
                <Link href="/homes" className="font-medium text-forest underline underline-offset-2">
                  Browse other homes
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </div>
    </Container>
  );
}
