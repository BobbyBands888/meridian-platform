import { requireLiveMarket } from "@/lib/market-data";

// Coming-soon markets don't have this section yet. Checked in a layout so those URLs return a real 404.
export default async function LiveMarketLayout({ children, params }: LayoutProps<"/[market]/dashboard/listing">) {
  await requireLiveMarket((await params).market);
  return children;
}
