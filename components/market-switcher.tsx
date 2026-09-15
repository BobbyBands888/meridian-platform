"use client";

import { useEffect, useId, useRef, useState } from "react";
import { brandName, marketUrl, type MarketLink } from "@/lib/markets";

type Props = { current: MarketLink; liveMarkets: MarketLink[]; hubUrl: string };

/** The header's region tag. Opens a menu of live markets, plus a link to every market (including coming soon). */
export function MarketSwitcher({ current, liveMarkets, hubUrl }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${current.region}. Switch market`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted hover:border-forest hover:text-forest"
      >
        {current.region}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={menuId} className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-[0_8px_30px_rgba(17,17,17,0.12)]">
          <p className="px-3 pb-1 pt-2 text-[12px] font-medium uppercase tracking-wider text-muted">Markets</p>
          <ul>
            {liveMarkets.map((m) => (
              <li key={m.slug}>
                <a
                  href={marketUrl(m)}
                  aria-current={m.slug === current.slug ? "true" : undefined}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[15px] hover:bg-surface"
                >
                  <span>
                    <span className="block font-semibold">{brandName(m)}</span>
                    <span className="block text-[13px] text-muted">{m.region}</span>
                  </span>
                  {m.slug === current.slug && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f4d3a" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </a>
              </li>
            ))}
          </ul>
          <a href={hubUrl} className="mt-1 block border-t border-line px-3 pb-1 pt-3 text-[14px] font-semibold text-forest hover:underline">
            All markets, including coming soon →
          </a>
        </div>
      )}
    </div>
  );
}
