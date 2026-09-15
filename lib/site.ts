import type { MarketStatus } from "@/lib/markets";

// Brand, domain, and sender details are per market: see lib/markets.ts.

const liveNavLinks = [
  { href: "/homes", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/vendors", label: "Vendors" },
  { href: "/guides", label: "Guides" },
];

/** Coming-soon markets have no listings, directory, or guides yet, so the header only offers sign-in. */
export function navLinksFor(market: { status: MarketStatus }) {
  return market.status === "live" ? liveNavLinks : [];
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
