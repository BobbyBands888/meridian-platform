import { notFound } from "next/navigation";
import { requireLiveMarket } from "@/lib/market-data";
import { categoryBySlug } from "@/lib/vendors";

// Validates the category here rather than in the page: layouts render before any loading.tsx boundary
// starts streaming, so unknown categories get a real 404 status instead of a soft 404.
export default async function VendorCategoryLayout({ children, params }: LayoutProps<"/[market]/vendors/[category]">) {
  const { market, category } = await params;
  await requireLiveMarket(market);
  if (category !== "all" && !categoryBySlug(category)) notFound();
  return children;
}
