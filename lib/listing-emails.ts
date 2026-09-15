import "server-only";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { DISCLOSURE_GUIDE_PATH, formatPrice, fullAddress, listingLocation, listingPath } from "@/lib/listings";

type ListingInfo = { id: string; slug: string; street: string; city: string; zip: string; hide_exact_address: boolean; price: number };

const label = (l: ListingInfo) => fullAddress(l);

export function sendListingReceived(to: string, listing: ListingInfo) {
  return sendEmail({
    to,
    subject: "We received your listing",
    heading: "We received your listing",
    blocks: [
      { kind: "p", text: `Thanks for listing ${label(listing)} at ${formatPrice(listing.price)}. We review every listing before it goes live, usually within 24 hours, and we'll email you when it's up.` },
      { kind: "p", text: "Tennessee requires sellers to provide buyers a Residential Property Condition Disclosure. Our guides explain it." },
      { kind: "button", label: "See the pre-sale checklist", href: siteLink("/sell/checklist") },
      { kind: "p", text: `Read the guides: ${siteLink(DISCLOSURE_GUIDE_PATH)}` },
    ],
  });
}

export function sendAdminNewListing(listing: ListingInfo, sellerEmail: string) {
  return sendEmail({
    to: adminEmail(),
    subject: `New listing to approve: ${label(listing)}`,
    heading: "New listing to review",
    blocks: [
      {
        kind: "rows",
        rows: [
          ["Address", label(listing)],
          ["Show street", listing.hide_exact_address ? "No, hidden" : "Yes"],
          ["Price", formatPrice(listing.price)],
          ["Seller", sellerEmail],
        ],
      },
      { kind: "button", label: "Review and approve", href: siteLink(`/admin/listings/${listing.id}`) },
    ],
  });
}

export function sendListingApproved(to: string, listing: ListingInfo) {
  return sendEmail({
    to,
    subject: "Your listing is live on Nashville Buys",
    heading: "Your listing is live",
    blocks: [
      { kind: "p", text: `${listingLocation(listing).headline} is now listed. Buyers can message you from the listing page, and their inquiries arrive by email.` },
      { kind: "button", label: "See your listing", href: siteLink(listingPath(listing)) },
      { kind: "p", text: `Manage your listing, update the price, or mark it under contract: ${siteLink("/dashboard/listing")}` },
    ],
  });
}

export function sendListingRejected(to: string, listing: ListingInfo, note: string) {
  return sendEmail({
    to,
    subject: "About your Nashville Buys listing",
    heading: "We couldn't approve your listing yet",
    blocks: [
      { kind: "p", text: `We reviewed ${label(listing)} and weren't able to publish it as submitted.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "p", text: "Reply to this email if you have questions." },
    ],
  });
}

export function sendAdminDescriptionEdit(listing: ListingInfo, sellerEmail: string, before: string, after: string) {
  return sendEmail({
    to: adminEmail(),
    subject: `Listing description edited: ${label(listing)}`,
    heading: "A live listing's description changed",
    blocks: [
      { kind: "p", text: "The new text passed the Fair Housing check and is already live. Here it is for a spot-check." },
      { kind: "rows", rows: [["Listing", label(listing)], ["Seller", sellerEmail]] },
      { kind: "p", text: "New description:" },
      { kind: "quote", text: after },
      { kind: "p", text: "Previous description:" },
      { kind: "quote", text: before },
      { kind: "button", label: "View listing", href: siteLink(listingPath(listing)) },
      { kind: "p", text: `Take it down if needed: ${siteLink(`/admin/listings/${listing.id}`)}` },
    ],
  });
}
