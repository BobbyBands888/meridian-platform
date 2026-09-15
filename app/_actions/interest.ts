"use server";

import { headers } from "next/headers";
import { adminEmail, sendEmail, siteLink } from "@/lib/email";
import { financingLabel, INTEREST_DISCLAIMER, interestRows, MAX_CLOSE_DAYS, needsLender, type Financing, type InterestDetails } from "@/lib/interest";
import { formatPrice } from "@/lib/listings";
import { getMarketById } from "@/lib/market-data";
import { brandName, isLive } from "@/lib/markets";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

type Field = "name" | "email" | "phone" | "offer_amount" | "financing" | "pre_approved" | "target_close" | "message" | "consent";

export type InterestState = {
  status?: "sent" | "error";
  message?: string;
  /** True when the buyer said they aren't pre-approved, so the page can suggest lenders. */
  showLenders?: boolean;
  errors?: Partial<Record<Field, string>>;
  values?: {
    name: string;
    email: string;
    phone: string;
    offer_amount: string;
    financing: string;
    pre_approved: string;
    target_close: string;
    message: string;
  };
};

const FINANCING: Financing[] = ["cash", "conventional", "fha", "va", "other"];
const DAY_MS = 24 * 60 * 60 * 1000;

const toInt = (value: string) => {
  const digits = value.replace(/[$,\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
};

/** Today in UTC as YYYY-MM-DD. Close dates are plain calendar dates, so no time zone is involved. */
const today = () => new Date().toISOString().slice(0, 10);

export async function sendInterest(_prev: InterestState, formData: FormData): Promise<InterestState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const listingId = text("listing_id");
  const name = text("name").replace(/\s+/g, " ");
  const email = text("email").toLowerCase();
  const phoneInput = text("phone");
  const offerInput = text("offer_amount");
  const financing = text("financing");
  const preApproved = text("pre_approved");
  const targetClose = text("target_close");
  const message = text("message");
  const consent = formData.get("consent") === "on";

  const values = { name, email, phone: phoneInput, offer_amount: offerInput, financing, pre_approved: preApproved, target_close: targetClose, message };
  const errors: InterestState["errors"] = {};

  if (name.length < 2 || name.length > 120) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  const phone = phoneInput ? normalizeUsPhone(phoneInput) : null;
  if (phoneInput && !phone) errors.phone = "Enter a 10-digit US phone number, or leave it blank.";

  const offer = toInt(offerInput);
  if (!Number.isFinite(offer) || offer < 1000 || offer > 100_000_000) errors.offer_amount = "Enter an amount in whole dollars.";
  if (!FINANCING.includes(financing as Financing)) errors.financing = "Choose how you'd pay.";
  // A cash buyer isn't borrowing, so the form hides the question and the answer is ignored.
  if (financing !== "cash" && preApproved !== "yes" && preApproved !== "no") {
    errors.pre_approved = "Let the seller know where you are with financing.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetClose) || Number.isNaN(Date.parse(`${targetClose}T12:00:00Z`))) {
    errors.target_close = "Choose the date you'd like to close.";
  } else if (targetClose < today()) {
    errors.target_close = "Choose a date in the future.";
  } else if (Date.parse(`${targetClose}T12:00:00Z`) > Date.now() + MAX_CLOSE_DAYS * DAY_MS) {
    errors.target_close = "Choose a date within the next two years.";
  }

  if (message.length > 5000) errors.message = "Keep your note under 5,000 characters.";
  if (!consent) errors.consent = "Check the box so the seller can reply to you.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(String(formData.get("turnstile_token") ?? ""), ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try sending again.", values };
  }

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, street, zip, hide_exact_address, price, market_id, profiles!inner(email)")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();
  if (!listing) {
    return { status: "error", message: "This home is no longer taking inquiries.", values };
  }

  const market = await getMarketById(listing.market_id);
  if (!isLive(market)) {
    return { status: "error", message: "This home is no longer taking inquiries.", values };
  }

  const details: InterestDetails = {
    offer_amount: offer,
    financing: financing as Financing,
    pre_approved: financing !== "cash" && preApproved === "yes",
    target_close: targetClose,
  };
  const path = `/homes/${listing.slug}`;
  const label = listing.hide_exact_address ? `your listing in ${listing.zip}` : listing.street;
  const pageUrl = siteLink(market, path);
  const brand = brandName(market);

  const { error: insertError } = await admin.from("leads").insert({
    type: "interest",
    target_id: listing.id,
    market_id: market.id,
    sender_name: name,
    sender_email: email,
    sender_phone: phone,
    // The note is optional on this form, but leads always carry a message.
    message: message || `Interested at ${formatPrice(offer)}, ${financingLabel(details.financing).toLowerCase()}.`,
    consent: true,
    source: path,
    details,
  });
  if (insertError) {
    console.error("interest insert failed", insertError.code, insertError.message);
    return { status: "error", message: "We couldn't send your interest. Please try again.", values };
  }

  const rows: [string, string][] = [
    ...interestRows(details),
    ["Name", name],
    ["Email", email],
    ...(phone ? ([["Phone", formatUsPhone(phone)]] as [string, string][]) : []),
    ["Listing", pageUrl],
  ];

  await Promise.all([
    sendEmail({
      market,
      to: listing.profiles.email,
      replyTo: email,
      subject: `${formatPrice(offer)} interest in ${label} from ${name}`,
      heading: `${name} is interested at ${formatPrice(offer)}`,
      blocks: [
        { kind: "p", text: INTEREST_DISCLAIMER },
        { kind: "rows", rows },
        ...(message ? ([{ kind: "quote" as const, text: message }] as const) : []),
        { kind: "p", text: `Reply to this email to reach ${name} directly. ${brand} doesn't take part in your conversation or any agreement you make.` },
      ],
    }),
    sendEmail({
      market,
      to: adminEmail(),
      replyTo: email,
      subject: `[Lead copy] ${formatPrice(offer)} interest in ${label}`,
      heading: "New expression of interest",
      blocks: [
        { kind: "rows", rows: [["For", label], ["Seller", listing.profiles.email], ["Asking", formatPrice(listing.price)], ["Market", brand], ...rows] },
        ...(message ? ([{ kind: "quote" as const, text: message }] as const) : []),
      ],
    }),
  ]);

  return {
    status: "sent",
    showLenders: needsLender(details),
    message: `Your interest went to the seller. They'll reply to ${email}.`,
  };
}
