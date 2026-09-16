"use client";

import { track } from "@vercel/analytics";

/** Seller listing funnel, in order. "submitted" and "email_verified" are tracked on the server. */
export type FunnelEvent = "form_start" | "contact_saved" | "address_done" | "photos_done" | "submitted" | "email_verified";

/** Sends a funnel event with where the seller came from (?s= on /sell), so drop-off can be compared by source. */
export function trackFunnel(event: FunnelEvent, source: string | null | undefined) {
  track(event, { source: source || "direct" });
}
