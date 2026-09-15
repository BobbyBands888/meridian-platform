import { cache } from "react";
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
