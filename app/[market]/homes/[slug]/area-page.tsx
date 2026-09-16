import type { Metadata } from "next";
import Link from "next/link";
import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { ListingCard } from "@/components/listing-card";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container, EmptyState } from "@/components/ui";
import { areaContent, isAreaIndexable, zipPhrase, type Area } from "@/lib/areas";
import { getGuides } from "@/lib/guides";
import { brandName, type Market } from "@/lib/markets";
import { getActiveListings } from "@/lib/public-listings";

/**
 * A page per named area in the market's ZIP map, at /homes/east-nashville and /homes/franklin. Listing slugs and
 * area slugs share the /homes/[slug] segment; see the page for how they're told apart.
 */

/** Two sentences: where the area is, and what the homes on it are. */
function intro(market: Market, area: Area) {
  // A town's area name is its own city name ("Franklin"); a neighborhood sits inside one ("East Nashville").
  const where =
    area.name === area.city
      ? `${area.name} covers ${zipPhrase(area.zips)} in ${area.county} County, ${market.region}.`
      : `${area.name} covers ${zipPhrase(area.zips)} in ${area.city}, ${market.state_code}, part of ${area.county} County.`;
  return [where, `Every home below is listed by its owner on ${brandName(market)}, so you message the seller directly instead of an agent.`];
}

export function areaMetadata(market: Market, area: Area): Metadata {
  const title = `${area.name} homes for sale by owner`;
  return {
    title,
    description: `For-sale-by-owner homes in ${area.name}, ${area.city}, ${market.state_code} (${zipPhrase(area.zips)}). Browse FSBO listings and contact sellers directly on ${brandName(market)}.`,
    alternates: { canonical: `/homes/${area.slug}` },
    robots: isAreaIndexable(market, area) ? undefined : { index: false },
    openGraph: { type: "website", title, url: `/homes/${area.slug}`, siteName: brandName(market) },
  };
}

export async function AreaPage({ market, area }: { market: Market; area: Area }) {
  const [listings, guides] = await Promise.all([getActiveListings(market.id, { zips: area.zips }), getGuides(market.slug)]);
  const [where, what] = intro(market, area);
  const content = areaContent(market, area);
  const zipOptions = area.zips.map((zip) => ({ zip, label: `${zip} · ${area.name}` }));

  return (
    <Container className="py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link href="/homes" className="hover:text-ink">
          Homes for sale
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/homes/areas" className="hover:text-ink">
          All areas
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{area.name}</span>
      </nav>

      <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
        Homes for sale by owner in {area.name}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        {where} {what}
      </p>
      {content && (
        <section aria-labelledby="area-about-heading" className="mt-10 max-w-3xl">
          <h2 id="area-about-heading" className="text-2xl font-bold tracking-tight">
            About {area.name}
          </h2>
          <div className="mt-4 space-y-4 text-[17px] leading-[1.75]">
            {content.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        {listings.length > 0 ? (
          <>
            <p className="mb-6 text-[15px] text-muted">
              {listings.length} {listings.length === 1 ? "home" : "homes"} for sale in {area.name}
            </p>
            <CardGrid>
              {listings.map((listing, i) => (
                <ListingCard key={listing.id} market={market} listing={listing} priority={i < 3} />
              ))}
            </CardGrid>
          </>
        ) : (
          <EmptyState title={`No ${area.name} homes listed right now`} actions={<ButtonLink href="/homes">See every home</ButtonLink>}>
            Owners list homes here as they go to market. Sign up below and you&apos;ll hear the day the next one in{" "}
            {area.name} goes up.
          </EmptyState>
        )}
      </div>

      <section aria-labelledby="area-alerts-heading" className="mt-14">
        <div className="rounded-3xl bg-surface px-6 py-10 sm:px-10">
          <h2 id="area-alerts-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            New {area.name} listings by email
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
            We&apos;ll email you when an owner lists a home in {zipPhrase(area.zips)}.
          </p>
          <div className="mt-6 max-w-3xl">
            <ListingAlertsForm defaultZip={area.zips[0]} zipOptions={zipOptions} submitLabel={`Alert me about ${area.name}`} />
          </div>
        </div>
      </section>

      <section aria-labelledby="area-next-heading" className="mt-14">
        <h2 id="area-next-heading" className="text-2xl font-bold tracking-tight">
          Selling a home in {area.name}?
        </h2>
        <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
          Listing is free, and these walk you through what {market.state} expects of a seller.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          <li>
            <Link href="/sell/checklist" className="group flex h-full flex-col rounded-2xl border border-line p-6 transition-colors hover:border-forest">
              <h3 className="text-xl font-semibold tracking-tight group-hover:text-forest">Pre-sale checklist</h3>
              <p className="mt-2 flex-1 text-[17px] leading-relaxed text-muted">
                Every step from getting ready to list through closing day, with your progress saved as you go.
              </p>
              <span className="mt-5 text-[15px] font-semibold text-forest">
                Open the checklist <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href={guides.length > 0 ? "/guides" : "/sell"} className="group flex h-full flex-col rounded-2xl border border-line p-6 transition-colors hover:border-forest">
              <h3 className="text-xl font-semibold tracking-tight group-hover:text-forest">
                {guides.length > 0 ? `${market.state} guides` : "List your home"}
              </h3>
              <p className="mt-2 flex-1 text-[17px] leading-relaxed text-muted">
                {guides.length > 0
                  ? "Plain-English guides to selling without an agent, pricing, showings, and the state disclosure form."
                  : "Post your home with photos and your asking price, free, and hear from buyers directly."}
              </p>
              <span className="mt-5 text-[15px] font-semibold text-forest">
                {guides.length > 0 ? "Read the guides" : "Start your listing"} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </Container>
  );
}
