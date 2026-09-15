"use server";

import { areaForZip, cityForZip, isServiceZip } from "@/lib/areas";
import { AI_MODEL, FEATURES_MAX, FEATURES_MIN, type DescriptionVariant } from "@/lib/ai-description";
import { writeDescriptions } from "@/lib/anthropic";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sign in again to use this." };

  const market = await getRequestMarket();
  if (!isLive(market)) return { status: "error", message: "This isn't available yet." };

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const draftId = text("draft_id");
  const zip = text("zip");
  const features = text("notable_features").replace(/\s+/g, " ");
  const beds = Number(text("beds"));
  const baths = Number(text("baths"));
  const sqft = toInt(text("sqft"));

  if (!UUID.test(draftId)) return { status: "error", message: "Reload the page and try again." };
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
  const { count } = await admin
    .from("listing_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return { status: "error", message: "You've used this a lot today. Try again tomorrow, or write the description yourself." };
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

  if (!result.ok) return { status: "error", message: result.error };

  // Logged against the draft now; createListing attaches the listing id once the seller submits.
  const { error } = await admin.from("listing_ai_usage").insert({
    draft_id: draftId,
    profile_id: user.id,
    market_id: market.id,
    model: AI_MODEL,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    variants: result.variants.length,
  });
  if (error) console.error("ai usage log failed", error.code, error.message);

  return { status: "ready", variants: result.variants };
}
