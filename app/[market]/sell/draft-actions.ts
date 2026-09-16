"use server";

import { track } from "@vercel/analytics/server";
import { headers } from "next/headers";
import { enrollInCourse } from "@/lib/course";
import { logFunnelEvent } from "@/lib/funnel-log";
import {
  clearDraftCookie,
  clientIp,
  clientIpHash,
  DRAFT_EMAIL_DAILY_LIMIT,
  DRAFT_IP_DAILY_LIMIT,
  DRAFT_PHOTO_MAX,
  draftPhotoFolder,
  getCookieDraft,
  hashDraftToken,
  newDraftToken,
  reachedStep,
  sendDraftVerification,
  setDraftCookie,
} from "@/lib/listing-drafts";
import { formErrorState, isPhotoInFolder, readListingForm, toInt, validateNewListingFields, validateShared, type ListingFormState } from "@/lib/listing-form";
import { getRequestMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
import { normalizeUsPhone } from "@/lib/phone";
import { allowSignInEmail } from "@/lib/sign-in";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ContactFormState = {
  status?: "saved" | "error";
  message?: string;
  errors?: Partial<Record<"full_name" | "email" | "phone", string>>;
  values?: { full_name: string; email: string; phone: string };
};

/** Funnel source from ?s= on /sell: short, lowercase, letters, digits, dashes, underscores. */
const cleanSource = (value: unknown) => {
  const s = String(value ?? "").trim().toLowerCase().slice(0, 60);
  return /^[a-z0-9_-]+$/.test(s) ? s : null;
};

/** Contact step: creates the draft, sets the cookie, and starts the seven-day course. */
export async function startDraft(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const values = { full_name: text("full_name").replace(/\s+/g, " "), email: text("email").toLowerCase(), phone: text("phone") };
  const source = cleanSource(formData.get("source"));

  const errors: ContactFormState["errors"] = {};
  if (values.full_name.length < 2 || values.full_name.length > 120) errors.full_name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254) errors.email = "Enter a valid email address.";
  const phone = values.phone ? normalizeUsPhone(values.phone) : null;
  if (values.phone && !phone) errors.phone = "Enter a 10-digit US phone number, or leave it blank.";
  if (Object.keys(errors).length > 0) return { status: "error", message: "Please fix the highlighted fields.", errors, values };

  const market = await getRequestMarket();
  if (!isLive(market)) return { status: "error", message: "Listings aren't open here yet.", values };

  if (!(await verifyTurnstile(text("turnstile_token"), await clientIp()))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values };
  }

  const admin = createAdminClient();
  const existing = await getCookieDraft(market);
  // Same browser, same draft: update the contact details instead of starting another.
  if (existing && existing.status === "draft") {
    const { error } = await admin
      .from("listing_drafts")
      .update({ full_name: values.full_name, email: values.email, phone })
      .eq("id", existing.id);
    if (error) {
      console.error("draft contact update failed", error.code, error.message);
      return { status: "error", message: "We couldn't save your details. Please try again.", values };
    }
    await logFunnelEvent(market.id, "contact_saved", existing.source, existing.id);
    return { status: "saved" };
  }

  const ipHash = await clientIpHash();
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const [byEmail, byIp] = await Promise.all([
    admin.from("listing_drafts").select("id", { count: "exact", head: true }).eq("email", values.email).gte("created_at", since),
    ipHash
      ? admin.from("listing_drafts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (byEmail.error || byIp.error) {
    console.error("draft limit check failed", byEmail.error?.message ?? byIp.error?.message);
    return { status: "error", message: "We couldn't save your details. Please try again.", values };
  }
  if ((byEmail.count ?? 0) >= DRAFT_EMAIL_DAILY_LIMIT || (byIp.count ?? 0) >= DRAFT_IP_DAILY_LIMIT) {
    return { status: "error", message: "You've started several listings today. Finish one you've started, or try again tomorrow.", values };
  }

  const token = newDraftToken();
  const { data: created, error } = await admin.from("listing_drafts").insert({
    market_id: market.id,
    token_hash: hashDraftToken(token),
    full_name: values.full_name,
    email: values.email,
    phone,
    source,
    ip_hash: ipHash,
  }).select("id").single();
  if (error || !created) {
    console.error("draft insert failed", error?.code, error?.message);
    return { status: "error", message: "We couldn't save your details. Please try again.", values };
  }
  await setDraftCookie(token);
  await logFunnelEvent(market.id, "contact_saved", source, created.id);

  // The course starts when someone gives their email, not when they verify it.
  await enrollInCourse(market, values.email, "/sell draft");
  return { status: "saved" };
}

export type DraftSaveResult = { ok: boolean; step?: string };

/** Autosave from the listing form. Keeps whatever is filled in; full validation happens on submit. */
export async function saveDraft(formData: FormData): Promise<DraftSaveResult> {
  const market = await getRequestMarket();
  const draft = await getCookieDraft(market);
  if (!draft || draft.status !== "draft") return { ok: false };

  const values = readListingForm(formData);
  const num = (v: string, max: number) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const price = toInt(values.price);
  const sqft = toInt(values.sqft);
  const photos = values.photo_urls.filter((u) => isPhotoInFolder(u, draftPhotoFolder(draft.id))).slice(0, DRAFT_PHOTO_MAX);
  const step = reachedStep(market, { ...values, photo_urls: photos }, draft.step);

  const { error } = await createAdminClient()
    .from("listing_drafts")
    .update({
      street: values.street.slice(0, 160) || null,
      zip: /^\d{5}$/.test(values.zip) ? values.zip : null,
      hide_exact_address: values.hide_exact_address,
      price: Number.isFinite(price) && price > 0 && price <= 100_000_000 ? price : null,
      beds: num(values.beds, 20),
      baths: num(values.baths, 20),
      sqft: Number.isFinite(sqft) && sqft > 0 && sqft <= 50_000 ? sqft : null,
      description: values.description.slice(0, 5000) || null,
      photo_urls: photos,
      step,
    })
    .eq("id", draft.id)
    .eq("status", "draft");
  if (error) {
    console.error("draft autosave failed", error.code, error.message);
    return { ok: false };
  }
  return { ok: true, step };
}

export type DraftSubmitState = ListingFormState & { submitted?: boolean };

/** Final submit: validates everything, marks the draft pending_verification, and emails the confirm link. */
export async function submitDraft(_prev: DraftSubmitState, formData: FormData): Promise<DraftSubmitState> {
  const market = await getRequestMarket();
  if (!isLive(market)) return { status: "error", message: "Listings aren't open here yet.", submittedAt: Date.now() };
  const draft = await getCookieDraft(market);
  if (!draft || draft.status !== "draft") {
    return { status: "error", message: "Your draft expired. Reload the page to start again.", submittedAt: Date.now() };
  }

  const values = readListingForm(formData);
  const { errors, price, fairHousing } = validateShared(values, { photoFolder: draftPhotoFolder(draft.id), photoMax: DRAFT_PHOTO_MAX });
  const { beds, baths, sqft } = validateNewListingFields(market, values, errors);
  if (Object.keys(errors).length > 0 || fairHousing.length > 0) return formErrorState(values, errors, fairHousing);

  if (!(await verifyTurnstile(String(formData.get("turnstile_token") ?? ""), await clientIp()))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values, submittedAt: Date.now() };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("listing_drafts")
    .update({
      street: values.street,
      zip: values.zip,
      hide_exact_address: values.hide_exact_address,
      price,
      beds,
      baths,
      sqft,
      description: values.description,
      photo_urls: values.photo_urls,
      status: "pending_verification",
      step: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error || !updated) {
    console.error("draft submit failed", error?.code, error?.message);
    return { status: "error", message: "We couldn't submit your listing. Please try again.", values, submittedAt: Date.now() };
  }

  await Promise.all([
    track("submitted", { source: draft.source ?? "direct", verified: false }, { headers: await headers() }).catch(() => {}),
    logFunnelEvent(market.id, "submitted", draft.source, draft.id),
  ]);
  try {
    if (await allowSignInEmail(updated.email)) await sendDraftVerification(market, updated);
  } catch (e) {
    console.error("draft verification email failed", e);
  }
  return { submitted: true };
}

export type ResendState = { status?: "sent" | "error"; message?: string };

/** "Didn't get it? Resend": same limit as sign-in emails (one a minute, five an hour). */
export async function resendDraftVerification(): Promise<ResendState> {
  const market = await getRequestMarket();
  const draft = await getCookieDraft(market);
  if (!draft || draft.status !== "pending_verification") return { status: "error", message: "There's nothing waiting to confirm. Reload the page." };
  try {
    if (!(await allowSignInEmail(draft.email))) return { status: "error", message: "We just sent one. Wait a minute, then try again." };
  } catch (e) {
    console.error(e);
    return { status: "error", message: "We couldn't send the email. Please try again." };
  }
  return (await sendDraftVerification(market, draft))
    ? { status: "sent", message: `Sent. Check ${draft.email}.` }
    : { status: "error", message: "We couldn't send the email. Please try again." };
}

/** "Not you? Start over": forgets the draft on this device. The draft itself is cleaned up later. */
export async function forgetDraft() {
  await clearDraftCookie();
}
