"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { trackBuyerToolOnce } from "@/components/buyer-tracking";

export type ChecklistStepView = {
  id: string;
  number: number;
  title: string;
  body: string;
  links: { href: string; label: string }[];
};

export type ChecklistSectionView = { number: number; title: string; steps: ChecklistStepView[] };

/** Browser storage key per checklist. The seller key predates the others and stays as it was. */
const STORAGE_KEYS = {
  seller: "nb-presale-checklist-v2",
  buyer: "nb-buyer-checklist-v1",
  moved_in: "nb-moved-in-checklist-v1",
} as const;

/** The first checkmark on a buyer checklist counts as starting it (once per browser). */
const START_EVENTS = { seller: null, buyer: "buyer_checklist_start", moved_in: "moved_in_start" } as const;

export type ChecklistKind = keyof typeof STORAGE_KEYS;

const CHANGE_EVENT = "nb-checklist-change";

// Per-browser convenience only; checkmarks themselves are never sent to the server.
function readDone(key: string): string {
  try {
    return localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeDone(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage blocked (private mode): checkmarks just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function Checklist({ sections, kind = "seller", sectionLabel = "Section" }: { sections: ChecklistSectionView[]; kind?: ChecklistKind; sectionLabel?: string }) {
  const key = STORAGE_KEYS[kind];
  const raw = useSyncExternalStore(subscribe, () => readDone(key), () => "[]");
  let done: string[] = [];
  try {
    done = JSON.parse(raw);
  } catch {
    done = [];
  }
  const allSteps = sections.flatMap((s) => s.steps);
  const doneCount = allSteps.filter((s) => done.includes(s.id)).length;
  const toggle = (id: string) => {
    const checking = !done.includes(id);
    const startEvent = START_EVENTS[kind];
    if (checking && startEvent) trackBuyerToolOnce(startEvent);
    writeDone(key, checking ? [...done, id] : done.filter((d) => d !== id));
  };

  return (
    <div className="max-w-3xl">
      <div className="sticky top-16 z-10 -mx-4 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] font-medium" aria-live="polite">
            {doneCount} of {allSteps.length} done
          </p>
          {doneCount > 0 && (
            <button type="button" onClick={() => writeDone(key, [])} className="text-[14px] text-muted underline underline-offset-2 hover:text-ink">
              Start over
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
          <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${allSteps.length ? (doneCount / allSteps.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="mt-6 space-y-10">
        {sections.map((section) => {
          const sectionDone = section.steps.filter((s) => done.includes(s.id)).length;
          return (
            <section key={section.number} aria-labelledby={`section-${section.number}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`section-${section.number}`} className="text-2xl font-bold tracking-tight">
                  <span className="text-muted">
                    {sectionLabel} {section.number} ·{" "}
                  </span>
                  {section.title}
                </h2>
                <span className="shrink-0 text-[14px] text-muted">
                  {sectionDone}/{section.steps.length}
                </span>
              </div>
              <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
                {section.steps.map((step) => {
                  const checked = done.includes(step.id);
                  // Stable ids like "alerts" could clash with section anchors on the page, so inputs get a prefix.
                  const inputId = step.id.startsWith("step-") ? step.id : `step-${step.id}`;
                  return (
                    <li key={step.id} className="flex gap-4 p-4 sm:p-5">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(step.id)}
                        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#1f4d3a]"
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={inputId} className={`block cursor-pointer text-[17px] font-semibold leading-snug ${checked ? "text-muted line-through" : ""}`}>
                          <span className="text-muted">{step.number}. </span>
                          {step.title}
                        </label>
                        {step.body && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{step.body}</p>}
                        {step.links.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {step.links.map((link) => (
                              <Link key={link.href} href={link.href} className="text-[15px] font-medium text-forest hover:underline">
                                {link.label} →
                              </Link>
                            ))}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
