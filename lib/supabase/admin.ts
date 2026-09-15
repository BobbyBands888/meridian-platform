import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Secret-key client that bypasses row-level security. Server only.
 * Use it only after checking the caller is allowed to do what you're about to do.
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase is not configured: set SUPABASE_SERVICE_ROLE_KEY.");
  return createSupabaseClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
