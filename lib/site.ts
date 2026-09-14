export const site = {
  name: "Nashville Buys",
  company: "Ownvista",
  url: "https://www.nashvillebuys.com",
  email: "hello@nashvillebuys.com",
  tagline: "Buy and sell direct. Nashville's FSBO hub.",
  description:
    "Nashville Buys is a free for-sale-by-owner listing hub for Nashville, TN, with a directory of vetted local vendors. Buyers and sellers connect directly.",
  disclaimer:
    "Nashville Buys connects buyers, sellers, and professionals directly. We are not a broker, do not hold funds, and do not facilitate closings. All parties should hire independent legal counsel.",
} as const;

export const navLinks = [
  { href: "/homes", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/vendors", label: "Vendors" },
  { href: "/guides", label: "Guides" },
] as const;

export const vendorCategories = [
  { value: "attorney", slug: "attorneys", label: "Attorneys", singular: "Attorney" },
  { value: "home_inspector", slug: "home-inspectors", label: "Home Inspectors", singular: "Home Inspector" },
  { value: "photographer", slug: "photographers", label: "Photographers", singular: "Photographer" },
  { value: "painter", slug: "painters", label: "Painters", singular: "Painter" },
  { value: "handyman", slug: "handymen", label: "Handymen", singular: "Handyman" },
  { value: "lender", slug: "lenders", label: "Lenders", singular: "Lender" },
] as const;

export type VendorCategory = (typeof vendorCategories)[number]["value"];
