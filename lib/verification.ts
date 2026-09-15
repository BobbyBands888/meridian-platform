import type { VendorCategoryValue } from "@/lib/database.types";
import { brandName, type Market } from "@/lib/markets";

/** Categories where a state license number is required to request the Verified badge. */
export const LICENSE_REQUIRED: VendorCategoryValue[] = ["attorney", "home_inspector", "lender", "home_insurance"];

export const licenseRequired = (category: VendorCategoryValue) => LICENSE_REQUIRED.includes(category);

export const COI_MAX_BYTES = 10 * 1024 * 1024;
export const COI_BUCKET = "vendor-documents";

type DateMarket = Pick<Market, "name" | "timezone">;

/** "September 18, 2026" in the market's own time zone. */
export function formatReviewDate(market: DateMarket, iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: market.timezone }).format(new Date(iso));
}

/** Public badge wording. The date is when the market's site reviewed the documents. */
export function verifiedBadgeText(market: DateMarket, verifiedAt: string) {
  return `License and insurance documents reviewed by ${brandName(market)} on ${formatReviewDate(market, verifiedAt)}`;
}
