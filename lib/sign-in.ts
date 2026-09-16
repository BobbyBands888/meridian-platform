import "server-only";
import { headers } from "next/headers";
import { getMarkets } from "@/lib/market-data";
import { marketOrigin, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";

const MINUTE_MS = 60_000;

/**
 * Link back to the host the visitor is on, so the session cookie lands on that site: any market domain (with or
 * without www), a Vercel preview, or local development (localhost and tampa.localhost style hosts). Any other Host
 * header gets the market's canonical address instead.
 */
export async function requestOrigin(market: Market) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (/^([a-z0-9-]+\.)?localhost(:\d+)?$/.test(host)) return `http://${host}`;
  if (host.endsWith(".vercel.app")) return `https://${host}`;
  const domains = (await getMarkets()).map((m) => m.domain);
  if (domains.includes(host.replace(/^www\./, ""))) return `https://${host}`;
  return marketOrigin(market);
}

/**
 * One sign-in email per address per minute, and five per hour. Supabase enforced this when it sent the emails; the
 * app sends them now (so each market's own sender and brand are used), so it keeps the limit itself.
 */
export async function allowSignInEmail(email: string) {
  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * MINUTE_MS).toISOString();
  const { data, error } = await admin.from("sign_in_link_requests").select("created_at").eq("email", email).gte("created_at", hourAgo);
  if (error) throw new Error(`sign-in rate limit check failed: ${error.message}`);
  const lastMinute = data.filter((r) => Date.parse(r.created_at) > Date.now() - MINUTE_MS).length;
  if (lastMinute >= 1 || data.length >= 5) return false;
  await admin.from("sign_in_link_requests").insert({ email });
  await admin.from("sign_in_link_requests").delete().eq("email", email).lt("created_at", hourAgo);
  return true;
}

/**
 * A one-time sign-in link to the confirm page on this site, or null if Supabase couldn't make one. Creates the
 * account on first use and records the market it was created on. `extra` adds query parameters for the confirm page.
 */
export async function createSignInLink(market: Market, email: string, next: string, extra: Record<string, string> = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    console.error("generateLink failed", error?.status, error?.message);
    return null;
  }
  // Record the site they signed up on, once, for the admin's Buyers tab; a null market_id means the account predates this.
  await admin.from("profiles").update({ market_id: market.id }).eq("email", email).is("market_id", null);

  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "email", next, ...extra });
  return `${await requestOrigin(market)}/auth/confirm?${params}`;
}
