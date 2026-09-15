import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DEFAULT_MARKET_SLUG, MARKET_SLUG, type Market } from "@/lib/markets";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";

/** All markets in display order, from the cached public read. Launching a market expires the "markets" tag. */
export const getMarkets = cache(async (): Promise<Market[]> => {
  const { data, error } = await createPublicClient({ tags: [CACHE_TAGS.markets], revalidate: 3600 })
    .from("markets")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Could not load markets: ${error.message}`);
  return data as Market[];
});

export async function getMarket(slug: string): Promise<Market | null> {
  if (!MARKET_SLUG.test(slug)) return null;
  return (await getMarkets()).find((m) => m.slug === slug) ?? null;
}

export async function getMarketById(id: string): Promise<Market> {
  const market = (await getMarkets()).find((m) => m.id === id);
  if (!market) throw new Error(`Unknown market ${id}`);
  return market;
}

/** The market for a [market] route segment; unknown slugs 404. */
export async function requireMarket(slug: string): Promise<Market> {
  const market = await getMarket(slug);
  if (!market) notFound();
  return market;
}

/** Listings, the directory, and guides exist only in live markets; in coming-soon markets those pages 404. */
export async function requireLiveMarket(slug: string): Promise<Market> {
  const market = await requireMarket(slug);
  if (market.status !== "live") notFound();
  return market;
}

/**
 * The market for the current request, for Server Actions and Route Handlers (which don't get route params).
 * The proxy sets x-market from the hostname and overwrites any value the client sent.
 */
export async function getRequestMarket(): Promise<Market> {
  const slug = (await headers()).get("x-market") ?? DEFAULT_MARKET_SLUG;
  return (await getMarket(slug)) ?? (await requireMarket(DEFAULT_MARKET_SLUG));
}
