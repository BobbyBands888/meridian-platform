import type { PublicVendor } from "@/lib/database.types";
import type { ModuleCategory } from "@/lib/site";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { fairVendorOrder } from "@/lib/vendor-order";
import { isDirectoryCategory } from "@/lib/vendors";

/**
 * Approved vendors for each category a page's vendor modules show, in fair order (verified first, rotating daily).
 * Planned trades have no vendors yet. A failed read returns empty lists, so modules fall back to their empty state
 * instead of breaking the page.
 */
export async function loadModuleVendors(marketId: string, categories: ModuleCategory[]): Promise<Map<ModuleCategory, PublicVendor[]>> {
  const directory = [...new Set(categories.filter(isDirectoryCategory))];
  const byCategory = new Map<ModuleCategory, PublicVendor[]>(categories.map((c) => [c, []]));
  if (directory.length === 0) return byCategory;

  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors] })
    .from("public_vendors")
    .select("*")
    .eq("market_id", marketId)
    .in("category", directory);
  if (error) {
    console.error("vendor modules: vendors query failed", error.message);
    return byCategory;
  }
  for (const category of directory) {
    byCategory.set(category, fairVendorOrder(data.filter((v) => v.category === category), category));
  }
  return byCategory;
}
