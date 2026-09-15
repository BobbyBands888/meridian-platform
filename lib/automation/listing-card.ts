import "server-only";
import { siteLink, type EmailBlock } from "@/lib/email";
import { formatPrice, formatSpecs, listingLocation, listingPath } from "@/lib/listings";
import type { Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";

export type ListingForCard = {
  id: string;
  slug: string;
  street: string;
  city: string;
  zip: string;
  hide_exact_address: boolean;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  status: string;
  market_id: string;
  cover_url: string | null;
};

/** Listings with their cover photo (the first photo), by id. Reads with the secret key. */
export async function loadListingsForCards(ids: string[]): Promise<Map<string, ListingForCard>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("listings")
    .select("id, slug, street, city, zip, hide_exact_address, price, beds, baths, sqft, status, market_id, listing_photos(url, sort_order)")
    .in("id", ids);
  if (error) throw new Error(`Could not load listings: ${error.message}`);
  return new Map(
    data.map((l) => {
      const { listing_photos, ...rest } = l;
      const cover = [...listing_photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
      return [l.id, { ...rest, cover_url: cover }];
    }),
  );
}

/**
 * Email-sized cover photo through the site's image optimizer (listing photos can be a couple of megabytes).
 * Email clients fetch it from the market's own domain.
 */
export function emailImageUrl(market: Market, url: string | null) {
  return url ? siteLink(market, `/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`) : null;
}

export function listingCardBlock(market: Market, listing: ListingForCard): EmailBlock {
  const location = listingLocation(market, listing);
  return {
    kind: "listing",
    href: siteLink(market, listingPath(listing)),
    imageUrl: emailImageUrl(market, listing.cover_url),
    imageAlt: `Photo of ${location.headline}`,
    price: formatPrice(listing.price),
    specs: formatSpecs(listing),
    place: listing.hide_exact_address ? location.area : `${location.headline}, ${location.area}`,
  };
}
