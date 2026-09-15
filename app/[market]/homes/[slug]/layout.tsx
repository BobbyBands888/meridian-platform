import { notFound } from "next/navigation";
import { requireMarket } from "@/lib/market-data";
import { getPublicListing } from "@/lib/public-listings";

// Checked in the layout so missing listings return a real 404 before the page's loading boundary streams.
export default async function ListingLayout({ children, params }: LayoutProps<"/[market]/homes/[slug]">) {
  const { market, slug } = await params;
  if (!(await getPublicListing((await requireMarket(market)).id, slug))) notFound();
  return children;
}
