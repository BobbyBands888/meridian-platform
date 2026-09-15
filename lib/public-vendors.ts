import { cache } from "react";
import type { VendorCategoryValue } from "@/lib/database.types";
import { vendorCategories } from "@/lib/site";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One approved vendor in this market, from the cached public view. Deduplicated per request. */
export const getPublicVendor = cache(async (marketId: string, id: string) => {
  if (!UUID.test(id)) return null;
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] })
    .from("public_vendors")
    .select("*")
    .eq("market_id", marketId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load vendor: ${error.message}`);
  return data;
});

/** Approved vendor count per category in this market, for hiding empty categories on public pages. */
export const getVendorCategoryCounts = cache(async (marketId: string) => {
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] }).from("public_vendors").select("category").eq("market_id", marketId);
  if (error) throw new Error(`Could not load vendor categories: ${error.message}`);
  const counts = new Map<VendorCategoryValue, number>();
  for (const { category } of data) counts.set(category, (counts.get(category) ?? 0) + 1);
  return counts;
});

/** Categories in display order that have at least one approved vendor in this market. */
export async function getActiveVendorCategories(marketId: string) {
  const counts = await getVendorCategoryCounts(marketId);
  return vendorCategories.filter((c) => (counts.get(c.value) ?? 0) > 0);
}

/** A few approved vendors in one category in this market, for cross-links like the lender suggestions. */
export const getVendorsInCategory = cache(async (marketId: string, category: VendorCategoryValue, limit = 3) => {
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] })
    .from("public_vendors")
    .select("*")
    .eq("market_id", marketId)
    .eq("category", category)
    // Verified vendors first, then the longest-standing.
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(`Could not load ${category} vendors: ${error.message}`);
  return data;
});
