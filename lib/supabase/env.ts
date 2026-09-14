/**
 * Public Supabase config. The variable names follow the project spec, but the values are the
 * new-format keys: NEXT_PUBLIC_SUPABASE_ANON_KEY holds the `sb_publishable_...` key.
 * Returns null until both are set so pages still render before Supabase is configured.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return env;
}
