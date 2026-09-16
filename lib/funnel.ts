"use client";

import { track } from "@vercel/analytics";
import { recordFunnelEvent } from "@/app/_actions/funnel";

/** Seller listing funnel, in order. contact_saved, submitted, and email_verified are also recorded on the server. */
export type FunnelEvent = "form_start" | "contact_saved" | "address_done" | "photos_done" | "submitted" | "email_verified";

/**
 * Sends a funnel event with where the seller came from (?s= on /sell): to Vercel Analytics, and to the funnel_events
 * table behind the admin Funnel tab (for the steps only the browser sees).
 */
export function trackFunnel(event: FunnelEvent, source: string | null | undefined) {
  track(event, { source: source || "direct" });
  if (event === "form_start" || event === "address_done" || event === "photos_done") {
    recordFunnelEvent(event, source ?? null).catch(() => {});
  }
}
