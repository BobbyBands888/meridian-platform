import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

/** Cache tags for public data. Server actions that change it call updateTag() with the same tag. */
export const CACHE_TAGS = { vendors: "vendors", listings: "listings", markets: "markets" } as const;

type Options = { tags: string[]; revalidate?: number };

/**
 * Cookie-free client with the publishable key for public pages. It can only read the public_* views.
 * Responses go in Next's data cache under the given tags, so approvals can expire them immediately;
 * revalidatePath alone doesn't clear cached fetches.
 */
export function createPublicClient({ tags, revalidate = 300 }: Options) {
  const { url, key } = requireSupabaseEnv();
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate, tags } }),
    },
  });
}
