import { getMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { badgeSvg } from "@/lib/vendor-badge";

export const revalidate = 3600;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The badge image a vendor embeds on their own site, at /badge/<vendor id> on the market's domain. It reads the
 * public view, so it only renders for approved vendors, and says "Verified" once verification is done.
 *
 * The path deliberately has no .svg extension: the proxy skips image extensions, so a /badge/<id>.svg URL would
 * never reach this market's route.
 */
export async function GET(_request: Request, { params }: RouteContext<"/[market]/badge/[id]">) {
  const { market: marketSlug, id } = await params;
  const market = await getMarket(marketSlug);
  if (!market || !isLive(market) || !UUID.test(id)) return new Response("Not found", { status: 404 });

  const { data: vendor, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors], revalidate: 3600 })
    .from("public_vendors")
    .select("id, verified_at")
    .eq("market_id", market.id)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("badge: vendor lookup failed", error.message);
  if (!vendor) return new Response("Not found", { status: 404 });

  return new Response(badgeSvg(market, Boolean(vendor.verified_at)), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Long shared cache so a vendor's page doesn't hit us on every view; revalidated hourly.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
