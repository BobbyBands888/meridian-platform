import "server-only";
import type { FunnelEventName } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { FunnelEventName } from "@/lib/database.types";

/** Buyer tool events the browser reports, each once per browser (see components/buyer-tracking.ts). */
export const BUYER_TOOL_EVENTS = ["buyer_checklist_start", "moved_in_start", "calculator_use"] as const satisfies readonly FunnelEventName[];

/** "?s=" value as stored: lowercase letters, digits, dashes, underscores, or "direct". */
export const funnelSource = (value: unknown) => {
  const s = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,60}$/.test(s) ? s : "direct";
};

/**
 * Records one funnel event: a step of the seller listing funnel, or a buyer tool use. With a draft, each step counts once
 * per draft (a unique index drops repeats). Never throws: losing an analytics row must not break the visitor's flow.
 */
export async function logFunnelEvent(marketId: string, event: FunnelEventName, source: unknown, draftId?: string | null, firstSource?: string | null) {
  const { error } = await createAdminClient()
    .from("funnel_events")
    .insert({ market_id: marketId, event, source: funnelSource(source), draft_id: draftId ?? null, ...(firstSource ? { first_source: firstSource } : {}) });
  if (error && error.code !== "23505") console.error("funnel event log failed", event, error.code, error.message);
}
