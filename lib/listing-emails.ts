import "server-only";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { getDisclosureGuidePath } from "@/lib/guides";
import { formatPrice, fullAddress, listingLocation, listingPath } from "@/lib/listings";
import { brandName, type Market } from "@/lib/markets";

type ListingInfo = { id: string; slug: string; street: string; city: string; zip: string; hide_exact_address: boolean; price: number };

export async function sendListingReceived(market: Market, to: string, listing: ListingInfo) {
  const guidePath = await getDisclosureGuidePath(market.slug);
  return sendEmail({
    market,
    to,
    subject: "We received your listing",
    heading: "We received your listing",
    blocks: [
      { kind: "p", text: `Thanks for listing ${fullAddress(market, listing)} at ${formatPrice(listing.price)}. We review every listing before it goes live, usually within 24 hours, and we'll email you when it's up.` },
      { kind: "p", text: guidePath ? `${market.disclosure_note} Our guide explains what it covers.` : market.disclosure_note },
      { kind: "button", label: "See the pre-sale checklist", href: siteLink(market, "/sell/checklist") },
      ...(guidePath ? [{ kind: "p" as const, text: `Disclosure guide: ${siteLink(market, guidePath)}` }] : []),
    ],
  });
}

export function sendAdminNewListing(market: Market, listing: ListingInfo, sellerEmail: string) {
  return sendEmail({
    market,
    to: adminEmail(),
    subject: `New listing to approve: ${fullAddress(market, listing)}`,
    heading: "New listing to review",
    blocks: [
      {
        kind: "rows",
        rows: [
          ["Address", fullAddress(market, listing)],
          ["Show street", listing.hide_exact_address ? "No, hidden" : "Yes"],
          ["Price", formatPrice(listing.price)],
          ["Seller", sellerEmail],
          ["Market", brandName(market)],
        ],
      },
      { kind: "button", label: "Review and approve", href: siteLink(market, `/admin/listings/${listing.id}`) },
    ],
  });
}

export function sendListingApproved(market: Market, to: string, listing: ListingInfo) {
  return sendEmail({
    market,
    to,
    subject: `Your listing is live on ${brandName(market)}`,
    heading: "Your listing is live",
    blocks: [
      { kind: "p", text: `${listingLocation(market, listing).headline} is now listed. Buyers can message you from the listing page, and their inquiries arrive by email.` },
      { kind: "button", label: "See your listing", href: siteLink(market, listingPath(listing)) },
      { kind: "p", text: `Manage your listing, update the price, or mark it under contract: ${siteLink(market, "/dashboard/listing")}` },
    ],
  });
}

export function sendListingRejected(market: Market, to: string, listing: ListingInfo, note: string) {
  return sendEmail({
    market,
    to,
    subject: `About your ${brandName(market)} listing`,
    heading: "We couldn't approve your listing yet",
    blocks: [
      { kind: "p", text: `We reviewed ${fullAddress(market, listing)} and weren't able to publish it as submitted.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "p", text: "Reply to this email if you have questions." },
    ],
  });
}

export function sendAdminDescriptionEdit(market: Market, listing: ListingInfo, sellerEmail: string, before: string, after: string) {
  return sendEmail({
    market,
    to: adminEmail(),
    subject: `Listing description edited: ${fullAddress(market, listing)}`,
    heading: "A live listing's description changed",
    blocks: [
      { kind: "p", text: "The new text passed the Fair Housing check and is already live. Here it is for a spot-check." },
      { kind: "rows", rows: [["Listing", fullAddress(market, listing)], ["Seller", sellerEmail], ["Market", brandName(market)]] },
      { kind: "p", text: "New description:" },
      { kind: "quote", text: after },
      { kind: "p", text: "Previous description:" },
      { kind: "quote", text: before },
      { kind: "button", label: "View listing", href: siteLink(market, listingPath(listing)) },
      { kind: "p", text: `Take it down if needed: ${siteLink(market, `/admin/listings/${listing.id}`)}` },
    ],
  });
}
