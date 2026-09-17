import { requireBuyerMarket } from "@/lib/buyer";

// Buyer pages exist only in markets with buyer features on (lib/markets.ts). Checked in a layout so other markets get a real 404.
export default async function BuyerLayout({ children, params }: LayoutProps<"/[market]/buy">) {
  await requireBuyerMarket((await params).market);
  return children;
}
