"use server";

import { headers } from "next/headers";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { getMarketById } from "@/lib/market-data";
import { brandName, isLive, type Market } from "@/lib/markets";
import { normalizeUsPhone, formatUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { vendorPath } from "@/lib/vendors";

export type InquiryState = {
  status?: "sent" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "email" | "phone" | "message" | "consent", string>>;
  values?: { name: string; email: string; phone: string; message: string };
};

type Recipient = { email: string; subjectLabel: string; pageUrl: string; source: string; market: Market };

async function findRecipient(type: string, targetId: string): Promise<Recipient | null> {
  const admin = createAdminClient();

  if (type === "vendor") {
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, category, business_name, status, market_id, profiles!inner(email)")
      .eq("id", targetId)
      .eq("status", "approved")
      .maybeSingle();
    if (!vendor) return null;
    const market = await getMarketById(vendor.market_id);
    if (!isLive(market)) return null;
    const path = vendorPath(vendor);
    return { email: vendor.profiles.email, subjectLabel: vendor.business_name, pageUrl: siteLink(market, path), source: path, market };
  }

  if (type === "listing") {
    const { data: listing } = await admin
      .from("listings")
      .select("id, slug, street, zip, hide_exact_address, status, market_id, profiles!inner(email)")
      .eq("id", targetId)
      .eq("status", "active")
      .maybeSingle();
    if (!listing) return null;
    const market = await getMarketById(listing.market_id);
    if (!isLive(market)) return null;
    const path = `/homes/${listing.slug}`;
    const label = listing.hide_exact_address ? `your listing in ${listing.zip}` : listing.street;
    return { email: listing.profiles.email, subjectLabel: label, pageUrl: siteLink(market, path), source: path, market };
  }

  return null;
}

export async function sendInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const type = String(formData.get("type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneInput = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const consent = formData.get("consent") === "on";
  const token = String(formData.get("turnstile_token") ?? "");

  const values = { name, email, phone: phoneInput, message };
  const errors: InquiryState["errors"] = {};
  if (name.length < 2 || name.length > 120) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  const phone = phoneInput ? normalizeUsPhone(phoneInput) : null;
  if (phoneInput && !phone) errors.phone = "Enter a 10-digit US phone number, or leave it blank.";
  if (message.length < 10) errors.message = "Write a short message (at least 10 characters).";
  if (message.length > 5000) errors.message = "Keep your message under 5,000 characters.";
  if (!consent) errors.consent = "Check the box so they can contact you about this inquiry.";
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(token, ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try sending again.", values };
  }

  const recipient = await findRecipient(type, targetId);
  if (!recipient) {
    return { status: "error", message: "This listing or vendor is no longer accepting inquiries.", values };
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("leads").insert({
    type: type as "vendor" | "listing",
    target_id: targetId,
    market_id: recipient.market.id,
    sender_name: name,
    sender_email: email,
    sender_phone: phone,
    message,
    consent: true,
    source: recipient.source,
  });
  if (insertError) {
    console.error("lead insert failed", insertError.code, insertError.message);
    return { status: "error", message: "We couldn't send your message. Please try again.", values };
  }

  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ...(phone ? ([["Phone", formatUsPhone(phone)]] as [string, string][]) : []),
    ["Page", recipient.pageUrl],
  ];

  await Promise.all([
    sendEmail({
      market: recipient.market,
      to: recipient.email,
      replyTo: email,
      subject: `New inquiry from ${name} via ${brandName(recipient.market)}`,
      heading: `${name} sent you a message`,
      blocks: [
        { kind: "p", text: `You have a new inquiry about ${recipient.subjectLabel}. Reply to this email to respond to ${name} directly.` },
        { kind: "quote", text: message },
        { kind: "rows", rows },
        { kind: "p", text: `${brandName(recipient.market)} doesn't take part in your conversation or any agreement you make.` },
      ],
    }),
    sendEmail({
      market: recipient.market,
      to: adminEmail(),
      replyTo: email,
      subject: `[Lead copy] ${type} inquiry for ${recipient.subjectLabel}`,
      heading: `New ${type} inquiry`,
      blocks: [
        { kind: "rows", rows: [["For", recipient.subjectLabel], ["Recipient", recipient.email], ["Market", brandName(recipient.market)], ...rows] },
        { kind: "quote", text: message },
      ],
    }),
  ]);

  return { status: "sent", message: "Your message was sent. They'll reply to you by email." };
}
