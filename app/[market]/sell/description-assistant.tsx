"use client";

import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { FEATURES_MAX, FEATURES_MIN, toneLabel, type Tone } from "@/lib/ai-description";
import { writeDescription, type DescriptionState } from "./ai-actions";

type Props = { draftId: string; onPick: (text: string) => void };

const toneHints: Record<Tone, string> = {
  straightforward: "Plain and factual",
  warm: "Inviting, same facts",
  short: "The tightest version",
};

/**
 * The "Write it for me" helper next to the description. It reads what's already in the form (beds, baths, square
 * feet, ZIP, and the notable-features box) and sends only those to the server action. Nothing is used until the
 * seller clicks one of the drafts.
 */
export function DescriptionAssistant({ draftId, onPick }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DescriptionState>({});
  const [pending, startTransition] = useTransition();

  function generate() {
    const form = root.current?.closest("form");
    if (!form) return;
    const data = new FormData(form);
    data.set("draft_id", draftId);
    startTransition(async () => setState(await writeDescription(data)));
  }

  return (
    <div ref={root} className="mt-5 rounded-xl border border-line bg-surface p-5">
      <input type="hidden" name="draft_id" value={draftId} />

      <label htmlFor="notable_features" className="block text-[15px] font-medium">
        Notable features
      </label>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        What stands out about the home: the kitchen, the yard, what you&apos;ve updated, how the rooms are laid out.
        Notes are fine.
      </p>
      <textarea
        id="notable_features"
        name="notable_features"
        rows={3}
        maxLength={FEATURES_MAX}
        minLength={FEATURES_MIN}
        placeholder="Fenced back yard, quartz counters, new roof in 2024, screened porch off the kitchen"
        className="mt-2 min-h-12 w-full rounded-lg border border-ink/20 px-4 py-3 text-base focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/15 bg-white px-5 text-[15px] font-semibold transition-colors hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Spinner />}
          {pending ? "Writing" : state.variants ? "Write three more" : "Write it for me"}
        </button>
        <p className="text-[13px] text-muted">Uses only what you&apos;ve entered above. Nothing is saved until you pick one.</p>
      </div>

      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-red-700">
        {state.status === "error" ? state.message : null}
      </p>

      {state.variants && state.variants.length > 0 && (
        <ul className="mt-4 space-y-3">
          {state.variants.map((variant) => (
            <li key={variant.tone}>
              <button
                type="button"
                onClick={() => onPick(variant.text)}
                className="w-full rounded-xl border border-line bg-white p-4 text-left transition-colors hover:border-forest"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-forest">{toneLabel(variant.tone)}</span>
                  <span className="text-[13px] text-muted">{toneHints[variant.tone]}</span>
                </span>
                <span className="mt-2 block text-[15px] leading-relaxed">{variant.text}</span>
                <span className="mt-2 block text-[13px] font-semibold text-forest">Use this one</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
