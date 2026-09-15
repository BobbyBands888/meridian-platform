import type { VendorCategoryValue } from "@/lib/database.types";

/** Categories where a state license number is required to request the Verified badge. */
export const LICENSE_REQUIRED: VendorCategoryValue[] = ["attorney", "home_inspector", "lender", "home_insurance"];

export const licenseRequired = (category: VendorCategoryValue) => LICENSE_REQUIRED.includes(category);

export const COI_MAX_BYTES = 10 * 1024 * 1024;
export const COI_BUCKET = "vendor-documents";

const badgeDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

/** Public badge wording. The date is when Nashville Buys reviewed the documents. */
export function verifiedBadgeText(verifiedAt: string) {
  return `License and insurance documents reviewed by Nashville Buys on ${badgeDate.format(new Date(verifiedAt))}`;
}

export function formatReviewDate(iso: string) {
  return badgeDate.format(new Date(iso));
}
