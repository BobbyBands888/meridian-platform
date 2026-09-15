"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export type ChecklistStep = { id: string; title: string; body: string; link?: { href: string; label: string } };

const STORAGE_KEY = "nb-presale-checklist";
const CHANGE_EVENT = "nb-checklist-change";

// Per-browser convenience only; nothing is sent to the server.
function readDone(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeDone(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
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

export function Checklist({ steps }: { steps: ChecklistStep[] }) {
  const raw = useSyncExternalStore(subscribe, readDone, () => "[]");
  let done: string[] = [];
  try {
    done = JSON.parse(raw);
  } catch {
    done = [];
  }
  const doneCount = steps.filter((s) => done.includes(s.id)).length;

  const toggle = (id: string) => writeDone(done.includes(id) ? done.filter((d) => d !== id) : [...done, id]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[15px] font-medium" aria-live="polite">
          {doneCount} of {steps.length} done
        </p>
        {doneCount > 0 && (
          <button type="button" onClick={() => writeDone([])} className="text-[14px] text-muted underline underline-offset-2 hover:text-ink">
            Start over
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className="mt-6 divide-y divide-line rounded-2xl border border-line">
        {steps.map((step, i) => {
          const checked = done.includes(step.id);
          return (
            <li key={step.id} className="flex gap-4 p-4 sm:p-5">
              <input
                id={`step-${step.id}`}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(step.id)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#1f4d3a]"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={`step-${step.id}`} className={`block cursor-pointer text-[17px] font-semibold ${checked ? "text-muted line-through" : ""}`}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </label>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{step.body}</p>
                {step.link && (
                  <Link href={step.link.href} className="mt-2 inline-block text-[15px] font-medium text-forest hover:underline">
                    {step.link.label} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
