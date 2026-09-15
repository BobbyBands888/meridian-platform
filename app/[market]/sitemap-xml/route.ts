import { marketAreas } from "@/lib/areas";
import { getGuides } from "@/lib/guides";
import { getMarket, getMarkets } from "@/lib/market-data";
import { isLive, marketUrl } from "@/lib/markets";
import { getSitemapListings } from "@/lib/public-listings";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { sitemapResponse, type SitemapEntry } from "@/lib/sitemap";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { vendorPath } from "@/lib/vendors";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getMarkets()).map((m) => ({ market: m.slug }));
}

// Public at /sitemap.xml on each market's own domain.
export async function GET(_request: Request, { params }: RouteContext<"/[market]/sitemap-xml">) {
  const market = await getMarket((await params).market);
  if (!market) return new Response("Not found", { status: 404 });
  const url = (path: string) => marketUrl(market, path);
  const now = new Date();

  // Coming-soon markets only have their launch page and the pages linked from its footer.
  if (!isLive(market)) {
    return sitemapResponse([
      { url: url("/"), changeFrequency: "weekly", priority: 1, lastModified: now },
      { url: url("/vendors/join"), changeFrequency: "monthly", priority: 0.6, lastModified: now },
      { url: url("/about"), changeFrequency: "yearly", priority: 0.4, lastModified: now },
      { url: url("/legal"), changeFrequency: "yearly", priority: 0.3, lastModified: now },
    ]);
  }

  const [activeCategories, guides] = await Promise.all([getActiveVendorCategories(market.id).catch(() => []), getGuides(market.slug)]);
  const staticPages: SitemapEntry[] = [
    { url: url("/"), changeFrequency: "daily", priority: 1, lastModified: now },
    { url: url("/homes"), changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: url("/homes/areas"), changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: url("/sell"), changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: url("/sell/checklist"), changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: url("/vendors"), changeFrequency: "weekly", priority: 0.8, lastModified: now },
    ...(activeCategories.length > 0 ? [{ url: url("/vendors/all"), changeFrequency: "weekly" as const, priority: 0.7, lastModified: now }] : []),
    ...activeCategories.map((c) => ({ url: url(`/vendors/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.7, lastModified: now })),
    { url: url("/vendors/join"), changeFrequency: "monthly", priority: 0.5, lastModified: now },
    ...(guides.length > 0 ? [{ url: url("/guides"), changeFrequency: "weekly" as const, priority: 0.7, lastModified: now }] : []),
    { url: url("/about"), changeFrequency: "yearly", priority: 0.4, lastModified: now },
    { url: url("/legal"), changeFrequency: "yearly", priority: 0.3, lastModified: now },
  ];

  const { data: vendors, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors], revalidate: 3600 })
    .from("public_vendors")
    .select("id, category, created_at")
    .eq("market_id", market.id);
  if (error) console.error("sitemap: vendors query failed", error.message);

  const listings = await getSitemapListings(market.id).catch((e) => {
    console.error("sitemap: listings query failed", e);
    return [];
  });

  return sitemapResponse([
    ...staticPages,
    // One page per neighborhood and town in the market's ZIP map.
    ...marketAreas(market).map((area) => ({ url: url(`/homes/${area.slug}`), changeFrequency: "weekly" as const, priority: 0.7, lastModified: now })),
    ...guides.map((g) => ({ url: url(`/guides/${g.slug}`), changeFrequency: "monthly" as const, priority: 0.7, lastModified: new Date(`${g.updatedAt}T12:00:00Z`) })),
    ...listings.map((l) => ({ url: url(`/homes/${l.slug}`), changeFrequency: "weekly" as const, priority: 0.8, lastModified: new Date(l.updated_at) })),
    ...(vendors ?? []).map((v) => ({ url: url(vendorPath(v)), changeFrequency: "monthly" as const, priority: 0.6, lastModified: new Date(v.created_at) })),
  ]);
}
