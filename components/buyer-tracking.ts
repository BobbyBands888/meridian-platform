"use client";

import { track } from "@vercel/analytics";
import { recordBuyerToolEvent } from "@/app/_actions/buyer-events";

type BuyerToolEvent = "buyer_checklist_start" | "moved_in_start" | "calculator_use";

/**
 * Records a buyer tool use once per browser (localStorage), or once per page view where storage is blocked, so the
 * admin counts show roughly how many people used each tool rather than how many clicks they made.
 */
export function trackBuyerToolOnce(event: BuyerToolEvent) {
  const key = `nb-tracked-${event}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    if (sessionFlags.has(event)) return;
  }
  sessionFlags.add(event);
  const source = new URLSearchParams(window.location.search).get("s");
  track(event, { source: source || "direct" });
  recordBuyerToolEvent(event, source).catch(() => {});
}

const sessionFlags = new Set<string>();
