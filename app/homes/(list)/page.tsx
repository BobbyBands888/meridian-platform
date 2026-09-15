import type { Metadata } from "next";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { ListingCard } from "@/components/listing-card";
import { zipsForSearch } from "@/lib/areas";
import { getActiveListings, type ListingFilters } from "@/lib/public-listings";
import { HomeFilters } from "./home-filters";

export const metadata: Metadata = {
  title: "Nashville homes for sale by owner",
  description:
    "Browse for-sale-by-owner homes in Nashville and Middle Tennessee, from Franklin to Murfreesboro and Hendersonville. Filter by price, beds, baths, and ZIP, and contact sellers directly.",
  alternates: { canonical: "/homes" },
};

const int = (v: string | string[] | undefined) => {
  const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function HomesPage({ searchParams }: PageProps<"/homes">) {
  const params = await searchParams;
  const q = str(params.q);
  const zip = str(params.zip);

  const filters: ListingFilters = {
    minPrice: int(params.min_price),
    maxPrice: int(params.max_price),
    beds: int(params.beds),
    baths: int(params.baths),
  };
  let unmatchedSearch = false;
  if (/^\d{5}$/.test(zip)) {
    filters.zips = [zip];
  } else if (q) {
    filters.zips = zipsForSearch(q);
    unmatchedSearch = filters.zips.length === 0;
  }

  const listings = unmatchedSearch ? [] : await getActiveListings(filters);
  // Prefill the alert ZIP when the visitor searched for one ZIP code.
  const alertZip = /^\d{5}$/.test(zip) ? zip : filters.zips?.length === 1 ? filters.zips[0] : "";
  const filtered = Boolean(q || zip || filters.minPrice || filters.maxPrice || filters.beds || filters.baths);

  return (
    <>
      <PageHeader title="Nashville homes for sale by owner" intro="Every home here is listed by its owner, across Nashville and Middle Tennessee. Reach sellers directly." />
      <Container>
        <HomeFilters values={{ q, zip, min_price: str(params.min_price), max_price: str(params.max_price), beds: str(params.beds), baths: str(params.baths) }} />

        <p className="mb-6 mt-8 text-[15px] text-muted" aria-live="polite">
          {listings.length === 0 ? "" : `${listings.length} ${listings.length === 1 ? "home" : "homes"}${filtered ? " match your filters" : " for sale"}`}
        </p>

        {listings.length > 0 ? (
          <CardGrid>
            {listings.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} priority={i < 3} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title={filtered ? "No homes match those filters" : "No homes listed yet"}
            actions={
              <>
                <ButtonLink href="/guides">Read the guides</ButtonLink>
                {filtered && (
                  <ButtonLink href="/homes" variant="secondary">
                    Clear filters
                  </ButtonLink>
                )}
              </>
            }
            footer={
              <section aria-labelledby="homes-alerts-heading">
                <h3 id="homes-alerts-heading" className="text-lg font-semibold tracking-tight">
                  Get new Nashville FSBO listings by email
                </h3>
                <p className="mb-4 mt-1 text-[15px] leading-relaxed text-muted">We&apos;ll let you know when owners list new homes.</p>
                <ListingAlertsForm defaultZip={alertZip} />
              </section>
            }
          >
            {filtered
              ? "Try a wider price range or a different neighborhood. New homes are added as owners list them."
              : "Nashville Buys is just opening. While the first listings come in, our guides explain how buying direct works in Tennessee."}
          </EmptyState>
        )}
      </Container>
    </>
  );
}
