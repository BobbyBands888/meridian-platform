"use server";

import { hasBuyerFeatures } from "@/lib/markets";
import { readFirstSource } from "@/lib/first-source";
import { BUYER_TOOL_EVENTS, logFunnelEvent } from "@/lib/funnel-log";
import { getRequestMarket } from "@/lib/market-data";

/** Logs a buyer tool use (checklist start, calculator use) with the visitor's page and first source. */
export async function recordBuyerToolEvent(event: string, source: string | null) {
  if (!(BUYER_TOOL_EVENTS as readonly string[]).includes(event)) return;
  const market = await getRequestMarket();
  if (!hasBuyerFeatures(market)) return;
  await logFunnelEvent(market.id, event as (typeof BUYER_TOOL_EVENTS)[number], source, null, await readFirstSource());
}
