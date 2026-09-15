import { notFound, permanentRedirect } from "next/navigation";
import { requireMarket } from "@/lib/market-data";
import { getPublicVendor } from "@/lib/public-vendors";
import { categoryByValue, vendorPath } from "@/lib/vendors";

// Runs before the profile's loading.tsx boundary, so missing vendors return a real 404
// and wrong-category URLs a real 308 instead of a client-side redirect.
export default async function VendorProfileLayout({ children, params }: LayoutProps<"/[market]/vendors/[category]/[id]">) {
  const { market: marketSlug, category, id } = await params;
  const market = await requireMarket(marketSlug);
  const vendor = await getPublicVendor(market.id, id);
  if (!vendor) notFound();
  if (categoryByValue(vendor.category).slug !== category) permanentRedirect(vendorPath(vendor));
  return children;
}
