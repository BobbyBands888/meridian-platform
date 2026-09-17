import "server-only";
import { notFound } from "next/navigation";
import { requireMarket } from "@/lib/market-data";
import { hasBuyerFeatures } from "@/lib/markets";

/** The market for a /buy route. Markets without buyer pages (coming-soon ones, or live ones not switched on) 404. */
export async function requireBuyerMarket(slug: string) {
  const market = await requireMarket(slug);
  if (!hasBuyerFeatures(market)) notFound();
  return market;
}
