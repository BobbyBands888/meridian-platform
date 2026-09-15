"use client";

const STORAGE_KEY = "nb-legal-dismissed";

export function LegalBanner({ brand, text }: { brand: string; text: string }) {
  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage unavailable (private mode): hide for this page view only.
    }
    document.documentElement.setAttribute("data-legal-dismissed", "");
  }

  return (
    <div id="legal-banner" role="note" aria-label={`About ${brand}`} className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 sm:px-6">
        <p className="flex-1 text-[13px] leading-relaxed text-muted">{text}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="-my-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
