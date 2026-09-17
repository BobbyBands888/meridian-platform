import { hasBuyerFeatures, type Market } from "@/lib/markets";

// Brand, domain, and sender details are per market: see lib/markets.ts.

/** Coming-soon markets have no listings, directory, or guides yet, so the header only offers sign-in. */
export function navLinksFor(market: Pick<Market, "slug" | "status">) {
  if (market.status !== "live") return [];
  return [
    // Markets with buyer pages send "Buy" to the /buy hub, which links to /homes at the top.
    { href: hasBuyerFeatures(market) ? "/buy" : "/homes", label: "Buy" },
    { href: "/sell", label: "Sell" },
    { href: "/vendors", label: "Vendors" },
    { href: "/guides", label: "Guides" },
  ];
}

/** Shown wherever the site invites vendors to join the directory. */
export const VENDOR_CATEGORY_LIMIT_NOTE = "We keep each category to a handful of pros so the leads mean something.";

export const vendorCategories = [
  // Title companies join this category too; the slug stays /vendors/attorneys.
  { value: "attorney", slug: "attorneys", label: "Closing Attorneys & Title", singular: "Closing Attorney or Title Company" },
  { value: "home_inspector", slug: "home-inspectors", label: "Home Inspectors", singular: "Home Inspector" },
  { value: "photographer", slug: "photographers", label: "Photographers", singular: "Photographer" },
  { value: "painter", slug: "painters", label: "Painters", singular: "Painter" },
  { value: "stager", slug: "stagers", label: "Stagers", singular: "Stager" },
  { value: "handyman", slug: "handymen", label: "Handymen", singular: "Handyman" },
  { value: "lender", slug: "lenders", label: "Lenders", singular: "Lender" },
  { value: "home_insurance", slug: "home-insurance", label: "Home Insurance", singular: "Home Insurance" },
] as const;

export type VendorCategory = (typeof vendorCategories)[number]["value"];

/**
 * Home-service trades the buyer and moved-in checklists point to before the directory accepts them. Vendor modules show
 * "We're adding vetted ..." for these, with no join link, since signup for them isn't open yet.
 */
export const plannedVendorCategories = [
  { value: "roofer", slug: "roofers", label: "Roofers", singular: "Roofer" },
  { value: "hvac", slug: "hvac", label: "HVAC", singular: "HVAC Pro" },
  { value: "plumber", slug: "plumbers", label: "Plumbers", singular: "Plumber" },
  { value: "electrician", slug: "electricians", label: "Electricians", singular: "Electrician" },
  { value: "pest_control", slug: "pest-control", label: "Pest & Termite Control", singular: "Pest & Termite Control Pro" },
  { value: "foundation_repair", slug: "foundation-crawlspace", label: "Foundation & Crawlspace", singular: "Foundation & Crawlspace Pro" },
] as const;

export type PlannedVendorCategory = (typeof plannedVendorCategories)[number]["value"];

/** A category a vendor module can show: one in the directory, or a planned trade. */
export type ModuleCategory = VendorCategory | PlannedVendorCategory;
