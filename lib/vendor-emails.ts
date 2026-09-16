import "server-only";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { brandName, isLive, type Market } from "@/lib/markets";
import { verifiedBadgeText } from "@/lib/verification";
import { categoryByValue, vendorPath } from "@/lib/vendors";
import type { VendorCategoryValue } from "@/lib/database.types";

type VendorInfo = { id: string; business_name: string; category: VendorCategoryValue };

const reviewLink = (market: Market, vendorId: string) => siteLink(market, `/admin/vendors/${vendorId}`);

const foundingCopy = (market: Market) =>
  `Free for founding vendors during our ${market.name} launch. When we introduce pricing, founding vendors get first notice and a locked-in rate.`;

/** Market row for admin emails, so it's obvious which site a submission came from. */
const marketRow = (market: Market): [string, string] => [
  "Market",
  `${brandName(market)}${isLive(market) ? "" : " (pre-launch)"}`,
];

export function sendVendorReceived(market: Market, to: string, vendor: VendorInfo) {
  const brand = brandName(market);
  if (!isLive(market)) {
    return sendEmail({
      market,
      to,
      subject: `You're pre-registered with ${brand}`,
      heading: `You're pre-registered with ${brand}`,
      blocks: [
        { kind: "p", text: `Thanks for pre-registering ${vendor.business_name}. We'll review your profile, and it goes live under ${categoryByValue(vendor.category).label} when ${brand} launches. We'll email you before then.` },
        { kind: "p", text: foundingCopy(market) },
        { kind: "button", label: "View your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
      ],
    });
  }
  return sendEmail({
    market,
    to,
    subject: "Received — you'll be live within 24 hours",
    heading: "Received — you'll be live within 24 hours",
    blocks: [
      { kind: "p", text: `Thanks for joining ${brand}. We're reviewing ${vendor.business_name} now, and you'll be listed under ${categoryByValue(vendor.category).label} within 24 hours.` },
      { kind: "p", text: foundingCopy(market) },
      { kind: "button", label: "View your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
    ],
  });
}

export function sendAdminNewVendor(market: Market, vendor: VendorInfo & { email: string }, resubmitted = false) {
  const kind = resubmitted ? "Resubmitted" : isLive(market) ? "New" : "Pre-launch";
  return sendEmail({
    market,
    to: adminEmail(),
    subject: `${kind} vendor to approve: ${vendor.business_name}`,
    heading: `${kind} vendor application`,
    blocks: [
      { kind: "rows", rows: [["Business", vendor.business_name], ["Category", categoryByValue(vendor.category).label], ["Account", vendor.email], marketRow(market)] },
      { kind: "button", label: "Review and approve", href: reviewLink(market, vendor.id) },
    ],
  });
}

export function sendAdminVendorEdit(market: Market, vendor: VendorInfo & { email: string }) {
  return sendEmail({
    market,
    to: adminEmail(),
    subject: `Vendor edit to approve: ${vendor.business_name}`,
    heading: "A vendor edited their profile",
    blocks: [
      { kind: "p", text: "They changed their business name, category, bio, or headshot. Their approved profile stays live until you approve the changes." },
      { kind: "rows", rows: [["Business", vendor.business_name], ["Account", vendor.email], marketRow(market)] },
      { kind: "button", label: "Review the edit", href: reviewLink(market, vendor.id) },
    ],
  });
}

export function sendVendorApproved(market: Market, to: string, vendor: VendorInfo) {
  const brand = brandName(market);
  if (!isLive(market)) {
    return sendEmail({
      market,
      to,
      subject: `You're approved for the ${brand} launch`,
      heading: `You're approved for the ${brand} launch`,
      blocks: [
        { kind: "p", text: `${vendor.business_name} is approved. Your profile will go live when ${brand} launches, listed under ${categoryByValue(vendor.category).label}. You don't need to do anything else. We'll let you know when you're live.` },
        { kind: "p", text: foundingCopy(market) },
        { kind: "button", label: "View your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
      ],
    });
  }
  return sendEmail({
    market,
    to,
    subject: `You're live on ${brand}`,
    heading: `You're live on ${brand}`,
    blocks: [
      { kind: "p", text: `${vendor.business_name} is now listed under ${categoryByValue(vendor.category).label}. Buyers and sellers can contact you through the form on your profile, and inquiries arrive by email.` },
      { kind: "button", label: "See your profile", href: siteLink(market, vendorPath(vendor)) },
      {
        kind: "p",
        text: `Want to stand out? Get the Verified badge: add your license number and certificate of insurance from your vendor dashboard. Once we review them, your profile shows "License and insurance documents reviewed by ${brand}" with the review date, and verified vendors are listed first in your category.`,
      },
      { kind: "p", text: `Vendor dashboard: ${siteLink(market, "/dashboard/vendor")}` },
    ],
  });
}

export function sendAdminVerificationSubmitted(market: Market, vendor: { id: string; business_name: string; email: string }, resubmitted: boolean) {
  return sendEmail({
    market,
    to: adminEmail(),
    subject: `${resubmitted ? "Updated" : "New"} verification documents: ${vendor.business_name}`,
    heading: `${vendor.business_name} ${resubmitted ? "updated their" : "sent"} verification documents`,
    blocks: [
      { kind: "rows", rows: [["Business", vendor.business_name], ["Account", vendor.email], marketRow(market)] },
      { kind: "button", label: "Review documents", href: siteLink(market, `/admin/vendors/${vendor.id}#verification`) },
    ],
  });
}

export function sendVendorVerified(market: Market, to: string, vendor: VendorInfo, verifiedAt: string) {
  const brand = brandName(market);
  if (!isLive(market)) {
    return sendEmail({
      market,
      to,
      subject: `You're verified for the ${brand} launch`,
      heading: "You're verified",
      blocks: [
        { kind: "p", text: `We reviewed the license and insurance documents for ${vendor.business_name}. Your profile will go live when ${brand} launches, showing "${verifiedBadgeText(market, verifiedAt)}", and you'll be listed first in your category.` },
        { kind: "p", text: "When your insurance renews, upload the new certificate from your vendor dashboard so we can review it again." },
        { kind: "button", label: "View your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
      ],
    });
  }
  return sendEmail({
    market,
    to,
    subject: "Your Verified badge is live",
    heading: "You're verified",
    blocks: [
      { kind: "p", text: `We reviewed the license and insurance documents for ${vendor.business_name}. Your profile now shows: "${verifiedBadgeText(market, verifiedAt)}", and you're listed first in your category.` },
      { kind: "p", text: "When your insurance renews, upload the new certificate from your vendor dashboard so we can review it again." },
      { kind: "button", label: "See your profile", href: siteLink(market, vendorPath(vendor)) },
    ],
  });
}

export function sendVendorRejected(market: Market, to: string, vendor: VendorInfo, note: string) {
  return sendEmail({
    market,
    to,
    subject: `About your ${brandName(market)} vendor application`,
    heading: "We couldn't approve your profile yet",
    blocks: [
      { kind: "p", text: `We reviewed ${vendor.business_name} and weren't able to approve it as submitted.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "p", text: "You can update your profile and resubmit it from your vendor dashboard." },
      { kind: "button", label: "Update your profile", href: siteLink(market, "/dashboard/vendor/edit") },
    ],
  });
}

/** For a vendor who was live in the directory and has been taken out of it (not a rejected application). */
export function sendVendorRemoved(market: Market, to: string, vendor: VendorInfo, note: string) {
  const brand = brandName(market);
  return sendEmail({
    market,
    to,
    subject: `Your ${brand} profile has been removed from the directory`,
    heading: "Your profile is no longer listed",
    blocks: [
      { kind: "p", text: `We've removed ${vendor.business_name} from the ${brand} vendor directory, so your profile no longer appears to buyers and sellers.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "p", text: "If you'd like to be listed again, update your profile from your vendor dashboard and we'll review it." },
      { kind: "button", label: "Open your vendor dashboard", href: siteLink(market, "/dashboard/vendor/edit") },
    ],
  });
}

export function sendVendorEditApproved(market: Market, to: string, vendor: VendorInfo) {
  return sendEmail({
    market,
    to,
    subject: isLive(market) ? "Your profile changes are live" : "Your profile changes are approved",
    heading: isLive(market) ? "Your profile changes are live" : "Your profile changes are approved",
    blocks: [
      isLive(market)
        ? { kind: "button", label: "See your profile", href: siteLink(market, vendorPath(vendor)) }
        : { kind: "button", label: "View your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
    ],
  });
}

export function sendVendorEditDeclined(market: Market, to: string, vendor: VendorInfo, note: string) {
  return sendEmail({
    market,
    to,
    subject: `About your ${brandName(market)} profile changes`,
    heading: "We couldn't approve your profile changes",
    blocks: [
      { kind: "p", text: `Your current profile for ${vendor.business_name} is ${isLive(market) ? "still live" : "unchanged"}. The changes you submitted weren't approved.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "button", label: "Edit your profile", href: siteLink(market, "/dashboard/vendor/edit") },
    ],
  });
}
