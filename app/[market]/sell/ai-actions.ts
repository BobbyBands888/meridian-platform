"use server";

import { areaForZip, cityForZip, isServiceZip } from "@/lib/areas";
import { AI_MODEL, FEATURES_MAX, FEATURES_MIN, type DescriptionVariant } from "@/lib/ai-description";
import { writeDescriptions } from "@/lib/anthropic";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_AI_LIMIT, getCookieDraft } from "@/lib/listing-drafts";
import { getRequestMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";

export type DescriptionState = {
  status?: "ready" | "error";
  message?: string;
  variants?: DescriptionVariant[];
};

/** Runs a seller can ask for in a day. Generous for one listing, and a ceiling on what a stolen session can spend. */
const DAILY_LIMIT = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toInt = (value: string) => {
  const digits = value.replace(/[$,\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
};

/**
 * Drafts three listing descriptions from what the seller has already typed. Nothing else about the listing is
 * sent: no street address, no price, and no text but the "notable features" box.
 */
export async function writeDescription(formData: FormData): Promise<DescriptionState> {
  const market = await getRequestMarket();
  if (!isLive(market)) return { status: "error", message: "This isn't available yet." };

  // Signed-in sellers, or an unverified draft in this browser (which gets a smaller allowance).
  const user = await getCurrentUser();
  const draft = user ? null : await getCookieDraft(market);
  if (!user && (!draft || draft.status !== "draft")) return { status: "error", message: "Reload the page and try again." };

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const draftId = text("draft_id");
  const zip = text("zip");
  const features = text("notable_features").replace(/\s+/g, " ");
  const beds = Number(text("beds"));
  const baths = Number(text("baths"));
  const sqft = toInt(text("sqft"));

  if (!UUID.test(draftId) || (draft && draftId !== draft.id)) return { status: "error", message: "Reload the page and try again." };
  if (features.length < FEATURES_MIN) {
    return { status: "error", message: `Add a few notable features first, at least ${FEATURES_MIN} characters.` };
  }
  if (features.length > FEATURES_MAX) {
    return { status: "error", message: `Keep the notable features under ${FEATURES_MAX.toLocaleString()} characters.` };
  }
  if (!isServiceZip(market, zip)) return { status: "error", message: "Choose a ZIP code first." };
  if (!Number.isInteger(beds) || beds < 0 || beds > 20) return { status: "error", message: "Fill in the number of bedrooms first." };
  if (!Number.isFinite(baths) || baths < 0 || baths > 20) return { status: "error", message: "Fill in the number of bathrooms first." };

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (user) {
    const { count } = await admin
      .from("listing_ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return { status: "error", message: "You've used this a lot today. Try again tomorrow, or write the description yourself." };
    }
  }

  // Drafts claim a usage row before calling the model, so simultaneous requests can't get past the per-draft limit.
  let claimId: string | null = null;
  if (!user) {
    const { data: claim, error: claimError } = await admin
      .from("listing_ai_usage")
      .insert({ draft_id: draftId, profile_id: null, market_id: market.id, model: AI_MODEL })
      .select("id, created_at")
      .single();
    if (claimError || !claim) return { status: "error", message: "Something went wrong. Please try again." };
    claimId = claim.id;
    const { count } = await admin.from("listing_ai_usage").select("id", { count: "exact", head: true }).eq("draft_id", draftId).lte("created_at", claim.created_at);
    if ((count ?? 0) > DRAFT_AI_LIMIT) {
      await admin.from("listing_ai_usage").delete().eq("id", claimId);
      return { status: "error", message: `You've used all ${DRAFT_AI_LIMIT} for this listing. Pick one of the drafts, or write the description yourself.` };
    }
  }

  const result = await writeDescriptions({
    beds,
    baths,
    sqft: Number.isFinite(sqft) ? sqft : null,
    // The listing form has no year-built field, so there's never one to send.
    yearBuilt: null,
    area: areaForZip(market, zip),
    city: cityForZip(market, zip),
    stateCode: market.state_code,
    features,
  });

  if (!result.ok) {
    if (claimId) await admin.from("listing_ai_usage").delete().eq("id", claimId);
    return { status: "error", message: result.error };
  }

  // Logged against the draft now; the listing id is attached once the seller submits (or verifies, for drafts).
  const usage = { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, variants: result.variants.length };
  const { error } = claimId
    ? await admin.from("listing_ai_usage").update(usage).eq("id", claimId)
    : await admin.from("listing_ai_usage").insert({ draft_id: draftId, profile_id: user?.id ?? null, market_id: market.id, model: AI_MODEL, ...usage });
  if (error) console.error("ai usage log failed", error.code, error.message);

  return { status: "ready", variants: result.variants };
}
