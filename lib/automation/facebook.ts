import "server-only";
import { formatPrice, formatSpecs, listingLocation, listingPath } from "@/lib/listings";
import { getMarketById } from "@/lib/market-data";
import { marketUrl, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadListingsForCards } from "./listing-card";

const GRAPH = "https://graph.facebook.com/v23.0";

/** FACEBOOK_PAGE_TOKEN_NASHVILLE for "nashville", FACEBOOK_PAGE_TOKEN_NEW_YORK for "new-york". */
export const facebookTokenVar = (market: Pick<Market, "slug">) => `FACEBOOK_PAGE_TOKEN_${market.slug.toUpperCase().replace(/-/g, "_")}`;

export type FacebookResult = { status: "posted" | "skipped" | "failed" | "already"; detail?: string };

/**
 * Posts a newly approved listing to its market's Facebook Page as a photo post: the cover photo with price, specs,
 * place, and a link in the caption. A market without a page token is skipped (and noted in the morning digest).
 * One row per listing in listing_syndication, claimed before posting, so a listing is never posted twice.
 */
export async function postListingToFacebook(listingId: string): Promise<FacebookResult> {
  const admin = createAdminClient();
  const listing = (await loadListingsForCards([listingId])).get(listingId);
  if (!listing || listing.status !== "active") return { status: "skipped", detail: "Listing isn't active" };
  const market = await getMarketById(listing.market_id);
  const tokenVar = facebookTokenVar(market);
  const token = process.env[tokenVar];

  const { data: claim, error: claimError } = await admin
    .from("listing_syndication")
    .upsert(
      { listing_id: listing.id, market_id: market.id, channel: "facebook", status: token ? "posting" : "skipped", error: token ? null : `${tokenVar} is not set` },
      { onConflict: "listing_id,channel", ignoreDuplicates: true },
    )
    .select("id");
  if (claimError) throw new Error(`Could not record Facebook post: ${claimError.message}`);
  if (claim.length === 0) return { status: "already" };
  if (!token) return { status: "skipped", detail: `${tokenVar} is not set` };
  if (!listing.cover_url) {
    await admin.from("listing_syndication").update({ status: "failed", error: "Listing has no photo" }).eq("id", claim[0].id);
    return { status: "failed", detail: "Listing has no photo" };
  }

  const location = listingLocation(market, listing);
  const place = listing.hide_exact_address ? location.area : `${location.headline}, ${location.area}`;
  const caption = [`${formatPrice(listing.price)} · ${formatSpecs(listing)}`, place, "For sale by owner. Message the seller directly:", marketUrl(market, listingPath(listing))].join("\n");

  try {
    // With a Page access token, "me" is the Page.
    const res = await fetch(`${GRAPH}/me/photos`, {
      method: "POST",
      body: new URLSearchParams({ url: listing.cover_url, caption, published: "true", access_token: token }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string; code?: number } };
    if (!res.ok || !(body.post_id || body.id)) {
      const message = `Graph API ${res.status}: ${body.error?.message ?? "unknown error"}`.slice(0, 1000);
      await admin.from("listing_syndication").update({ status: "failed", error: message }).eq("id", claim[0].id);
      return { status: "failed", detail: message };
    }
    await admin.from("listing_syndication").update({ status: "posted", external_id: body.post_id ?? body.id, error: null }).eq("id", claim[0].id);
    return { status: "posted", detail: body.post_id ?? body.id };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await admin.from("listing_syndication").update({ status: "failed", error: message }).eq("id", claim[0].id);
    return { status: "failed", detail: message };
  }
}
