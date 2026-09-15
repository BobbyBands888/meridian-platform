import { cache } from "react";
import type { VendorCategoryValue } from "@/lib/database.types";
import { vendorCategories } from "@/lib/site";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One approved vendor by id, from the cached public view. Deduplicated per request. */
export const getPublicVendor = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] })
    .from("public_vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load vendor: ${error.message}`);
  return data;
});

/** Approved vendor count per category, for hiding empty categories on public pages. */
export const getVendorCategoryCounts = cache(async () => {
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] }).from("public_vendors").select("category");
  if (error) throw new Error(`Could not load vendor categories: ${error.message}`);
  const counts = new Map<VendorCategoryValue, number>();
  for (const { category } of data) counts.set(category, (counts.get(category) ?? 0) + 1);
  return counts;
});

/** Categories in display order that have at least one approved vendor. */
export async function getActiveVendorCategories() {
  const counts = await getVendorCategoryCounts();
  return vendorCategories.filter((c) => (counts.get(c.value) ?? 0) > 0);
}
