import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cityForZip, isServiceZip } from "@/lib/areas";
import type { ListingDraft, ListingDraftStep } from "@/lib/database.types";
import { sendEmail, sendEmailWithId, siteLink, type Unsubscribe } from "@/lib/email";
import { listingPhotoPrefix, toInt, type ListingFormValues } from "@/lib/listing-form";
import { sendAdminNewListing, sendListingReceived } from "@/lib/listing-emails";
import { LISTING_PHOTO_MAX } from "@/lib/listings";
import { brandName, type Market } from "@/lib/markets";
import { createSignInLink } from "@/lib/sign-in";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Listing drafts: a seller who isn't signed in fills out /sell as a draft tied to an unverified email. The browser
 * holds a random token in an httpOnly cookie; only its SHA-256 hash is stored. Submitting emails a sign-in link, and
 * clicking it turns the draft into a pending listing on their account (see finalizeDraft). Drafts never touch the
 * listings table before then, so nothing unverified can be public.
 */

export const DRAFT_COOKIE = "nb_listing_draft";
export const DRAFT_PHOTO_MAX = LISTING_PHOTO_MAX;
/** "Write it for me" runs per draft. */
export const DRAFT_AI_LIMIT = 3;
/** New drafts per email in 24 hours. */
export const DRAFT_EMAIL_DAILY_LIMIT = 3;
/** New drafts per IP in 24 hours. Higher than per email: mobile carriers put many people behind one address. */
export const DRAFT_IP_DAILY_LIMIT = 20;
/** Signed upload URLs per draft: the photo limit plus room for retries and swaps. */
export const DRAFT_UPLOAD_LIMIT = 75;
export const DRAFT_RETENTION_DAYS = 14;
const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET = "listing-photos";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isDraftId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
export const isDraftToken = (value: unknown): value is string => typeof value === "string" && TOKEN.test(value);
export const hashDraftToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newDraftToken = () => randomBytes(32).toString("base64url");

export async function setDraftCookie(token: string) {
  (await cookies()).set(DRAFT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRAFT_RETENTION_DAYS * 24 * 60 * 60,
  });
}

export async function clearDraftCookie() {
  (await cookies()).delete(DRAFT_COOKIE);
}

/** SHA-256 of the client's IP, for the per-IP draft limit. */
export async function clientIpHash() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? createHash("sha256").update(`listing-draft:${ip}`).digest("hex") : null;
}

export async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

const isExpired = (draft: Pick<ListingDraft, "created_at">, now = Date.now()) => now - Date.parse(draft.created_at) > DRAFT_RETENTION_DAYS * DAY_MS;

/** The draft this browser's cookie points to in this market, unless it's expired. */
export async function getCookieDraft(market: Pick<Market, "id">): Promise<ListingDraft | null> {
  const token = (await cookies()).get(DRAFT_COOKIE)?.value;
  if (!isDraftToken(token)) return null;
  const hash = hashDraftToken(token);
  const { data, error } = await createAdminClient()
    .from("listing_drafts")
    .select("*")
    .eq("market_id", market.id)
    .or(`token_hash.eq.${hash},resume_token_hash.eq.${hash}`)
    .maybeSingle();
  if (error) {
    console.error("draft lookup failed", error.code, error.message);
    return null;
  }
  return data && !isExpired(data) ? data : null;
}

export const draftPhotoFolder = (draftId: string) => `drafts/${draftId}`;

/** A draft's saved fields in the shape the listing form uses. */
export function draftFormValues(draft: ListingDraft): ListingFormValues {
  const str = (v: number | null) => (v === null ? "" : String(Number(v)));
  return {
    street: draft.street ?? "",
    zip: draft.zip ?? "",
    hide_exact_address: draft.hide_exact_address,
    price: str(draft.price),
    beds: str(draft.beds),
    baths: str(draft.baths),
    sqft: str(draft.sqft),
    description: draft.description ?? "",
    photo_urls: draft.photo_urls,
  };
}

const STEP_ORDER: ListingDraftStep[] = ["contact", "address", "details", "photos", "submitted"];
export const stepIndex = (step: ListingDraftStep) => STEP_ORDER.indexOf(step);

/** The furthest section the saved values complete, never moving backwards from `current`. */
export function reachedStep(market: Market, values: ListingFormValues, current: ListingDraftStep): ListingDraftStep {
  const address = values.street.length >= 3 && /\d/.test(values.street) && isServiceZip(market, values.zip);
  const details = address && Number.isFinite(toInt(values.price)) && values.beds !== "" && values.baths !== "" && Number.isFinite(toInt(values.sqft));
  const photos = details && values.photo_urls.length > 0;
  const computed: ListingDraftStep = photos ? "photos" : details ? "details" : address ? "address" : "contact";
  return stepIndex(computed) > stepIndex(current) ? computed : current;
}

/** Storage path inside the listing-photos bucket for a public photo URL, if it's in that bucket. */
function storagePath(url: string) {
  const base = listingPhotoPrefix("drafts")?.replace(/drafts\/$/, "");
  return base && url.startsWith(base) && !url.includes("..") ? url.slice(base.length) : null;
}

const publicUrl = (path: string) => createAdminClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** Sends the "confirm your email" sign-in link for a submitted draft. */
export async function sendDraftVerification(market: Market, draft: ListingDraft): Promise<boolean> {
  const link = await createSignInLink(market, draft.email, "/sell/checklist?submitted=1", { draft: draft.id });
  if (!link) return false;
  const brand = brandName(market);
  const sent = await sendEmail({
    market,
    to: draft.email,
    subject: "Confirm your email to submit your listing",
    heading: "Confirm your email to submit your listing for review",
    blocks: [
      { kind: "p", text: `Thanks, ${draft.full_name.split(" ")[0]}. One step left: confirm this is your email and we'll send your listing to our review queue. We usually review within 24 hours.` },
      { kind: "button", label: "Confirm and submit my listing", href: link },
      { kind: "p", text: `This also signs you in to ${brand}, where buyer messages arrive. The link works once and expires in one hour; you can get a new one from the page you submitted on.` },
      { kind: "p", text: "If you didn't list a home with us, ignore this email and nothing will be published." },
    ],
  });
  if (sent) {
    await createAdminClient().from("listing_drafts").update({ verification_sent_at: new Date().toISOString() }).eq("id", draft.id);
  }
  return sent;
}

/**
 * Turns a submitted draft into a pending listing for the signed-in seller whose verified email matches it: moves
 * its photos into their own folder, creates the listing (the database checks the email and that it runs once), and
 * sends the usual "we received your listing" emails. Returns null if the draft isn't theirs or isn't ready.
 */
export async function finalizeDraft(market: Market, draftId: string, user: { id: string; email: string }) {
  const admin = createAdminClient();
  const { data: draft } = await admin.from("listing_drafts").select("*").eq("id", draftId).eq("market_id", market.id).maybeSingle();
  if (!draft || draft.email !== user.email.toLowerCase()) return null;
  if (draft.status === "verified") return draft.listing_id ? { listingId: draft.listing_id, already: true } : null;
  if (draft.status !== "pending_verification" || !draft.zip || !draft.street || draft.price === null) return null;

  // Photos move from drafts/<id>/ to <user id>/, where the seller's dashboard can manage them.
  const photoUrls: string[] = [];
  for (const url of draft.photo_urls) {
    const from = storagePath(url);
    if (!from) continue;
    const to = `${user.id}/${from.split("/").pop()}`;
    if (from.startsWith(`${draftPhotoFolder(draft.id)}/`)) {
      const { error } = await admin.storage.from(BUCKET).move(from, to);
      // Already moved by an earlier attempt.
      if (error && !/not.?found/i.test(error.message)) {
        console.error("draft photo move failed", error.message);
        return null;
      }
      photoUrls.push(publicUrl(to));
    } else if (from.startsWith(`${user.id}/`)) {
      photoUrls.push(url);
    }
  }
  // finalize_listing_draft saves the moved URLs on the draft. If it fails, the draft keeps its old URLs, and a retry
  // treats files that are no longer in the draft folder as already moved.
  const { data, error } = await admin.rpc("finalize_listing_draft", {
    p_draft: draft.id,
    p_profile: user.id,
    p_city: cityForZip(market, draft.zip),
    p_photo_urls: photoUrls,
  });
  const created = data?.[0];
  if (error || !created) {
    console.error("finalize draft failed", error?.code, error?.message);
    return null;
  }

  // Photos the seller uploaded and then removed are still in the draft folder.
  const leftovers = await draftFiles(draft.id).catch(() => []);
  if (leftovers.length) await admin.storage.from(BUCKET).remove(leftovers);

  const listing = {
    id: created.id,
    slug: created.slug,
    street: draft.street,
    city: cityForZip(market, draft.zip),
    zip: draft.zip,
    hide_exact_address: draft.hide_exact_address,
    price: draft.price,
  };
  await Promise.all([sendListingReceived(market, draft.email, listing), sendAdminNewListing(market, listing, draft.email)]);
  return { listingId: created.id, already: false, source: draft.source };
}

export type UploadTarget = { path: string; token: string; publicUrl: string } | { error: string };

/**
 * A signed upload URL for one photo in the browser's draft folder. Counts toward the draft's upload ceiling. Served by
 * a route handler rather than a server action: Next runs server actions one at a time, and the uploader asks for
 * several of these at once.
 */
export async function claimDraftUploadTarget(market: Pick<Market, "id">): Promise<UploadTarget> {
  const draft = await getCookieDraft(market);
  if (!draft || draft.status !== "draft") return { error: "Your draft expired. Reload the page." };

  // Compare-and-set on the counter; the uploader sends a few photos at once, so retry when another request won.
  const admin = createAdminClient();
  let claimed = false;
  let uploads = draft.photo_uploads;
  for (let attempt = 0; attempt < 8 && !claimed; attempt++) {
    if (uploads >= DRAFT_UPLOAD_LIMIT) return { error: "You've reached the upload limit for this draft." };
    const { data } = await admin
      .from("listing_drafts")
      .update({ photo_uploads: uploads + 1 })
      .eq("id", draft.id)
      .eq("photo_uploads", uploads)
      .select("id");
    claimed = Boolean(data?.length);
    if (!claimed) {
      const { data: current } = await admin.from("listing_drafts").select("photo_uploads").eq("id", draft.id).maybeSingle();
      if (!current) return { error: "Your draft expired. Reload the page." };
      uploads = current.photo_uploads;
    }
  }
  if (!claimed) return { error: "Upload failed. Remove it and try again." };

  const path = `${draftPhotoFolder(draft.id)}/${crypto.randomUUID()}.jpg`;
  const bucket = admin.storage.from("listing-photos");
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) {
    console.error("draft upload url failed", error?.message);
    return { error: "Upload failed. Remove it and try again." };
  }
  return { path: data.path, token: data.token, publicUrl: bucket.getPublicUrl(data.path).data.publicUrl };
}

export const draftUnsubscribePath = (token: string) => `/sell/resume/unsubscribe?token=${token}`;

function reminderUnsubscribe(market: Market, token: string): Unsubscribe {
  return {
    url: siteLink(market, draftUnsubscribePath(token)),
    oneClickUrl: siteLink(market, `/sell/resume/unsubscribe/one-click?token=${token}`),
    label: "You're getting this because you started a listing and didn't finish it.",
  };
}

export type DraftReminderResult = { sent: number; failed: number };

/**
 * The daily job's step: one reminder, ever, to each draft with an email that wasn't submitted within 24 hours. The
 * draft is claimed (reminder_sent_at set) before sending, so a retry or overlapping run can't send a second.
 */
export async function sendDraftReminders(markets: Market[], now = new Date()): Promise<DraftReminderResult> {
  const admin = createAdminClient();
  const byId = new Map(markets.map((m) => [m.id, m]));
  const { data, error } = await admin
    .from("listing_drafts")
    .select("*")
    .eq("status", "draft")
    .is("reminder_sent_at", null)
    .is("reminders_unsubscribed_at", null)
    .lt("created_at", new Date(now.getTime() - REMINDER_AFTER_MS).toISOString())
    .gt("created_at", new Date(now.getTime() - DRAFT_RETENTION_DAYS * DAY_MS).toISOString())
    .limit(500);
  if (error) throw new Error(`draft reminders query failed: ${error.message}`);

  const result: DraftReminderResult = { sent: 0, failed: 0 };
  for (const draft of data ?? []) {
    const market = byId.get(draft.market_id);
    if (!market) continue;
    const resumeToken = newDraftToken();
    const { data: claimed } = await admin
      .from("listing_drafts")
      .update({ reminder_sent_at: now.toISOString(), resume_token_hash: hashDraftToken(resumeToken) })
      .eq("id", draft.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const brand = brandName(market);
    const sent = await sendEmailWithId({
      market,
      to: draft.email,
      subject: `Your ${brand} listing is saved — finish in 2 minutes`,
      heading: "Your listing is saved",
      blocks: [
        { kind: "p", text: `Hi ${draft.full_name.split(" ")[0]}, you started listing your home on ${brand}. Everything you entered is saved, so you can pick up right where you left off.` },
        { kind: "button", label: "Finish my listing", href: siteLink(market, `/sell/resume?t=${resumeToken}`) },
        { kind: "p", text: `Listing is free, and buyers contact you directly. Saved drafts are deleted after ${DRAFT_RETENTION_DAYS} days.` },
      ],
      unsubscribe: reminderUnsubscribe(market, draft.unsubscribe_token),
      idempotencyKey: `draft-reminder:${draft.id}`,
    });
    if (sent.ok) result.sent += 1;
    else result.failed += 1;
  }
  return result;
}

export type DraftCleanupResult = { drafts: number; files: number };

/** Every file under a draft's photo folder. */
async function draftFiles(draftId: string) {
  const folder = draftPhotoFolder(draftId);
  const { data, error } = await createAdminClient().storage.from(BUCKET).list(folder, { limit: 1000 });
  if (error) throw new Error(`draft photo list failed: ${error.message}`);
  return (data ?? []).map((f) => `${folder}/${f.name}`);
}

/**
 * The daily job's step: deletes drafts that were never verified, and their photos, 14 days after they were started.
 * Verified drafts are kept as the record of where a listing came from; finalizeDraft already cleared their folder.
 */
export async function cleanupDrafts(now = new Date()): Promise<DraftCleanupResult> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - DRAFT_RETENTION_DAYS * DAY_MS).toISOString();
  const { data, error } = await admin.from("listing_drafts").select("id").neq("status", "verified").lt("created_at", cutoff).limit(500);
  if (error) throw new Error(`draft cleanup query failed: ${error.message}`);

  const result: DraftCleanupResult = { drafts: 0, files: 0 };
  for (const draft of data ?? []) {
    const files = await draftFiles(draft.id);
    if (files.length) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(files);
      if (removeError) throw new Error(`draft photo delete failed: ${removeError.message}`);
      result.files += files.length;
    }
    const { error: deleteError } = await admin.from("listing_drafts").delete().eq("id", draft.id).neq("status", "verified");
    if (deleteError) throw new Error(`draft delete failed: ${deleteError.message}`);
    result.drafts += 1;
  }
  return result;
}
