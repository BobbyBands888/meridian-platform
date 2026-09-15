import { PhotoCard } from "@/components/photo-card";
import type { AreaMarket } from "@/lib/areas";
import { formatPrice, formatSpecs, listingLocation, listingPath } from "@/lib/listings";
import type { ListingWithCover } from "@/lib/public-listings";

export function ListingCard({ market, listing, priority }: { market: AreaMarket; listing: ListingWithCover; priority?: boolean }) {
  const location = listingLocation(market, listing);
  return (
    <PhotoCard
      href={listingPath(listing)}
      imageUrl={listing.cover_url}
      imageAlt={`Photo of ${location.headline}`}
      priority={priority}
      eyebrow={location.area}
      title={formatPrice(listing.price)}
      subtitle={location.headline}
      meta={<span className="text-muted">{formatSpecs(listing)}</span>}
      checks={["For sale by owner"]}
    />
  );
}
