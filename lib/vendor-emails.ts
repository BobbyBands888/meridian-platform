import "server-only";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { categoryByValue, vendorPath } from "@/lib/vendors";
import type { VendorCategoryValue } from "@/lib/database.types";

type VendorInfo = { id: string; business_name: string; category: VendorCategoryValue };

const reviewLink = (vendorId: string) => siteLink(`/admin/vendors/${vendorId}`);

export function sendVendorReceived(to: string, vendor: VendorInfo) {
  return sendEmail({
    to,
    subject: "Received — you'll be live within 24 hours",
    heading: "Received — you'll be live within 24 hours",
    blocks: [
      { kind: "p", text: `Thanks for joining Nashville Buys. We're reviewing ${vendor.business_name} now, and you'll be listed under ${categoryByValue(vendor.category).label} within 24 hours.` },
      { kind: "p", text: "Free for founding vendors during our Nashville launch. When we introduce pricing, founding vendors get first notice and a locked-in rate." },
      { kind: "button", label: "View your vendor dashboard", href: siteLink("/dashboard/vendor") },
    ],
  });
}

export function sendAdminNewVendor(vendor: VendorInfo & { email: string }, resubmitted = false) {
  return sendEmail({
    to: adminEmail(),
    subject: `${resubmitted ? "Resubmitted" : "New"} vendor to approve: ${vendor.business_name}`,
    heading: `${resubmitted ? "Resubmitted" : "New"} vendor application`,
    blocks: [
      { kind: "rows", rows: [["Business", vendor.business_name], ["Category", categoryByValue(vendor.category).label], ["Account", vendor.email]] },
      { kind: "button", label: "Review and approve", href: reviewLink(vendor.id) },
    ],
  });
}

export function sendAdminVendorEdit(vendor: VendorInfo & { email: string }) {
  return sendEmail({
    to: adminEmail(),
    subject: `Vendor edit to approve: ${vendor.business_name}`,
    heading: "A vendor edited their profile",
    blocks: [
      { kind: "p", text: "They changed their business name, category, bio, or headshot. Their approved profile stays live until you approve the changes." },
      { kind: "rows", rows: [["Business", vendor.business_name], ["Account", vendor.email]] },
      { kind: "button", label: "Review the edit", href: reviewLink(vendor.id) },
    ],
  });
}

export function sendVendorApproved(to: string, vendor: VendorInfo) {
  return sendEmail({
    to,
    subject: "You're live on Nashville Buys",
    heading: "You're live on Nashville Buys",
    blocks: [
      { kind: "p", text: `${vendor.business_name} is now listed under ${categoryByValue(vendor.category).label}. Buyers and sellers can contact you through the form on your profile, and inquiries arrive by email.` },
      { kind: "button", label: "See your profile", href: siteLink(vendorPath(vendor)) },
    ],
  });
}

export function sendVendorRejected(to: string, vendor: VendorInfo, note: string) {
  return sendEmail({
    to,
    subject: "About your Nashville Buys vendor application",
    heading: "We couldn't approve your profile yet",
    blocks: [
      { kind: "p", text: `We reviewed ${vendor.business_name} and weren't able to approve it as submitted.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "p", text: "You can update your profile and resubmit it from your vendor dashboard." },
      { kind: "button", label: "Update your profile", href: siteLink("/dashboard/vendor/edit") },
    ],
  });
}

export function sendVendorEditApproved(to: string, vendor: VendorInfo) {
  return sendEmail({
    to,
    subject: "Your profile changes are live",
    heading: "Your profile changes are live",
    blocks: [{ kind: "button", label: "See your profile", href: siteLink(vendorPath(vendor)) }],
  });
}

export function sendVendorEditDeclined(to: string, vendor: VendorInfo, note: string) {
  return sendEmail({
    to,
    subject: "About your Nashville Buys profile changes",
    heading: "We couldn't approve your profile changes",
    blocks: [
      { kind: "p", text: `Your current profile for ${vendor.business_name} is still live. The changes you submitted weren't approved.` },
      ...(note ? [{ kind: "quote" as const, text: note }] : []),
      { kind: "button", label: "Edit your profile", href: siteLink("/dashboard/vendor/edit") },
    ],
  });
}
