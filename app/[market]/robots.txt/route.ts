import { getMarket, getMarkets } from "@/lib/market-data";
import { marketOrigin } from "@/lib/markets";
import { robotsResponse } from "@/lib/sitemap";

export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getMarkets()).map((m) => ({ market: m.slug }));
}

// Public at /robots.txt on each market's own domain.
export async function GET(_request: Request, { params }: RouteContext<"/[market]/robots.txt">) {
  const market = await getMarket((await params).market);
  if (!market) return new Response("Not found", { status: 404 });
  return robotsResponse({ origin: marketOrigin(market), disallow: ["/admin", "/dashboard", "/api/", "/auth/", "/sign-in", "/welcome", "/alerts/"] });
}
