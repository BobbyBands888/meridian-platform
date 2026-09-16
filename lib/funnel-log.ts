import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const FUNNEL_EVENTS = ["form_start", "contact_saved", "address_done", "photos_done", "submitted", "email_verified"] as const;
export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

/** "?s=" value as stored: lowercase letters, digits, dashes, underscores, or "direct". */
export const funnelSource = (value: unknown) => {
  const s = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,60}$/.test(s) ? s : "direct";
};

/**
 * Records one step of the seller listing funnel. With a draft, each step counts once per draft (a unique index
 * drops repeats). Never throws: losing an analytics row must not break the seller's flow.
 */
export async function logFunnelEvent(marketId: string, event: FunnelEventName, source: unknown, draftId?: string | null) {
  const { error } = await createAdminClient()
    .from("funnel_events")
    .insert({ market_id: marketId, event, source: funnelSource(source), draft_id: draftId ?? null });
  if (error && error.code !== "23505") console.error("funnel event log failed", event, error.code, error.message);
}
