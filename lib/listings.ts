import type { ListingStatus } from "@/lib/database.types";
import { areaForZip, locationLine, type AreaMarket } from "@/lib/areas";

export const LISTING_PHOTO_MAX = 20;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 5000;

const priceFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat("en-US");

export function formatPrice(price: number) {
  return priceFmt.format(price);
}

export function formatSpecs(listing: { beds: number; baths: number; sqft: number | null }) {
  const beds = Number(listing.beds);
  const baths = Number(listing.baths);
  const parts = [`${beds} bd`, `${baths} ba`];
  if (listing.sqft) parts.push(`${numberFmt.format(listing.sqft)} sqft`);
  return parts.join(" · ");
}

export function listingPath(listing: { slug: string }) {
  return `/homes/${listing.slug}`;
}

/** Public-facing location: street when shown, otherwise area and ZIP only. */
export function listingLocation(market: AreaMarket, listing: { street: string | null; hide_exact_address: boolean; zip: string; city: string }) {
  return {
    headline: !listing.hide_exact_address && listing.street ? listing.street : `Home in ${areaForZip(market, listing.zip)}`,
    area: locationLine(market, listing.zip, listing.city),
  };
}

/** Private location for the seller and admin: full street plus area. */
export function fullAddress(market: AreaMarket, listing: { street: string; zip: string; city: string }) {
  return `${listing.street}, ${locationLine(market, listing.zip, listing.city)}`;
}

export const statusLabels: Record<ListingStatus, string> = {
  pending: "In review",
  active: "Active",
  under_contract: "Under contract",
  sold: "Sold",
  rejected: "Not approved",
};

/** "3 bedroom home in East Nashville, Nashville, TN" style summary for titles and previews. */
export function listingSummary(market: AreaMarket, listing: { beds: number; zip: string; city: string; price: number }) {
  const area = areaForZip(market, listing.zip);
  const place = area === listing.city ? listing.city : `${area}, ${listing.city}`;
  return `${Number(listing.beds)} bedroom home in ${place}, ${market.state_code}, for sale by owner at ${formatPrice(listing.price)}`;
}
