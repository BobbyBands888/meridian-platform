import { DEFAULT_MARKET_SLUG, HUB_DOMAINS, MARKET_SLUG } from "@/lib/markets";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type HostTarget = { kind: "market"; slug: string } | { kind: "hub" };

type DomainRow = { slug: string; domain: string };

const TTL_MS = 60_000;
let cached: { rows: DomainRow[]; at: number } | null = null;

/**
 * Market domains from the markets table, kept in memory for a minute. Fetch caching doesn't apply in the proxy, so
 * this avoids a database read on every request. On an error the last good list keeps being used.
 */
async function marketDomains(): Promise<DomainRow[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows;
  const env = getSupabaseEnv();
  if (!env) return cached?.rows ?? [];
  try {
    const res = await fetch(`${env.url}/rest/v1/markets?select=slug,domain`, {
      headers: { apikey: env.key, authorization: `Bearer ${env.key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`markets lookup failed: ${res.status}`);
    cached = { rows: (await res.json()) as DomainRow[], at: Date.now() };
  } catch (error) {
    console.error("market domain lookup failed", error);
    if (cached) cached.at = Date.now() - TTL_MS / 2; // Retry in 30 seconds instead of on every request.
  }
  return cached?.rows ?? [];
}

/**
 * Picks the site for a Host header.
 * - A market's domain, with or without www: that market. getownvista.com: the hub.
 * - Local development: localhost is Nashville; tampa.localhost:3000 simulates Tampa and hub.localhost the hub.
 * - Anything else (Vercel preview URLs, unknown hosts): Nashville.
 */
export async function resolveHost(hostHeader: string | null): Promise<HostTarget> {
  const host = (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");

  if (HUB_DOMAINS.includes(host)) return { kind: "hub" };

  const local = host.match(/^([a-z0-9-]+)\.localhost$/);
  if (local) {
    if (local[1] === "hub") return { kind: "hub" };
    if (MARKET_SLUG.test(local[1])) return { kind: "market", slug: local[1] };
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) {
    return { kind: "market", slug: DEFAULT_MARKET_SLUG };
  }

  const match = (await marketDomains()).find((m) => m.domain === host);
  return { kind: "market", slug: match?.slug ?? DEFAULT_MARKET_SLUG };
}
