import { notFound } from "next/navigation";
import { areaBySlug } from "@/lib/areas";
import { requireMarket } from "@/lib/market-data";
import { getPublicListing } from "@/lib/public-listings";

// Checked in the layout so missing listings return a real 404 before the page's loading boundary streams.
// The segment also serves the neighborhood pages, whose slugs come from the market's ZIP map.
export default async function ListingLayout({ children, params }: LayoutProps<"/[market]/homes/[slug]">) {
  const { market: marketSlug, slug } = await params;
  const market = await requireMarket(marketSlug);
  if (areaBySlug(market, slug)) return children;
  if (!(await getPublicListing(market.id, slug))) notFound();
  return children;
}
