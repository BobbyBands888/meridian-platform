import type { ListingStatus } from "@/lib/database.types";
import { areaForZip, locationLine } from "@/lib/areas";

export const LISTING_PHOTO_MAX = 20;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 5000;

// Updated in Phase 6 when the disclosure guide is published.
export const DISCLOSURE_GUIDE_PATH = "/guides";

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
export function listingLocation(listing: { street: string | null; hide_exact_address: boolean; zip: string; city: string }) {
  return {
    headline: !listing.hide_exact_address && listing.street ? listing.street : `Home in ${areaForZip(listing.zip)}`,
    area: locationLine(listing.zip, listing.city),
  };
}

/** Private location for the seller and admin: full street plus area. */
export function fullAddress(listing: { street: string; zip: string; city: string }) {
  return `${listing.street}, ${locationLine(listing.zip, listing.city)}`;
}

export const statusLabels: Record<ListingStatus, string> = {
  pending: "In review",
  active: "Active",
  under_contract: "Under contract",
  sold: "Sold",
  rejected: "Not approved",
};

/** "3 bedroom home in East Nashville, Nashville" style summary for titles and previews. */
export function listingSummary(listing: { beds: number; zip: string; city: string; price: number }) {
  const area = areaForZip(listing.zip);
  const place = area === listing.city ? listing.city : `${area}, ${listing.city}`;
  return `${Number(listing.beds)} bedroom home in ${place}, TN, for sale by owner at ${formatPrice(listing.price)}`;
}
