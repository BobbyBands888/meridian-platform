"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = { label: string; value: string; hint?: string; rows?: number };

/**
 * A read-only snippet with a Copy button. The field stays selectable and the value is in the markup, so copying
 * still works by hand where the clipboard API is blocked (older browsers, or an insecure origin).
 */
export function CopyField({ label, value, hint, rows = 1 }: Props) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    field.current?.select();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Selected above, so Cmd+C or Ctrl+C works.
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </label>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-ink/15 px-3 py-1 text-[14px] font-semibold transition-colors hover:border-forest hover:text-forest"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      <textarea
        ref={field}
        id={id}
        readOnly
        rows={rows}
        value={value}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full resize-none rounded-lg border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </p>
    </div>
  );
}
