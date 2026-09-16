"use server";

import { getCookieDraft } from "@/lib/listing-drafts";
import { logFunnelEvent } from "@/lib/funnel-log";
import { getRequestMarket } from "@/lib/market-data";

/** Steps the browser reports; the rest (contact_saved, submitted, email_verified) are logged where they happen on the server. */
const CLIENT_EVENTS = ["form_start", "address_done", "photos_done"] as const;

export async function recordFunnelEvent(event: string, source: string | null) {
  if (!(CLIENT_EVENTS as readonly string[]).includes(event)) return;
  const market = await getRequestMarket();
  const draft = await getCookieDraft(market);
  await logFunnelEvent(market.id, event as (typeof CLIENT_EVENTS)[number], source, draft?.status === "draft" ? draft.id : null);
}
