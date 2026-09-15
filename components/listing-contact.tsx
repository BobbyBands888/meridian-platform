"use client";

import { useId, useState, type ReactNode } from "react";
import { ContactForm } from "@/components/contact-form";
import { InterestForm } from "@/components/interest-form";

type Tab = "message" | "interest";

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: "message", label: "Send a message", blurb: "Ask a question or set up a time to see the home." },
  { key: "interest", label: "Express interest", blurb: "Tell the seller your number, financing, and timing." },
];

type Props = { listingId: string; brand: string; closeRange: { min: string; max: string }; lenderCards?: ReactNode };

/**
 * The two ways to reach a seller, side by side on every listing: a plain message, and a structured expression of
 * interest. Only the open one is mounted, so the page never loads two Turnstile widgets at once.
 */
export function ListingContact({ listingId, brand, closeRange, lenderCards }: Props) {
  const [tab, setTab] = useState<Tab>("message");
  const id = useId();
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div>
      <div role="tablist" aria-label="How to reach the seller" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-${t.key}-tab`}
            aria-selected={tab === t.key}
            aria-controls={`${id}-${t.key}-panel`}
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-lg px-3 text-[15px] font-semibold transition-colors ${
              tab === t.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-6 mt-4 text-[15px] leading-relaxed text-muted">{current.blurb}</p>

      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`}>
        {tab === "message" ? (
          <ContactForm type="listing" targetId={listingId} recipientLabel="the seller" brand={brand} />
        ) : (
          <InterestForm listingId={listingId} brand={brand} closeRange={closeRange} lenderCards={lenderCards} />
        )}
      </div>
    </div>
  );
}
