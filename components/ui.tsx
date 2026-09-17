import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const variants = {
  // Near-black text on the warm accent keeps contrast above WCAG AA (white on #D97A3A is only ~3:1).
  primary: "bg-warm text-ink hover:bg-warm-dark",
  secondary: "border border-ink/15 bg-white text-ink hover:border-forest hover:text-forest",
  forest: "bg-forest text-white hover:bg-forest-dark",
  // Outline button for dark backgrounds. Overriding secondary's colors with className doesn't work reliably, since
  // Tailwind orders utilities by its own rules, not by their order in the class string.
  onDark: "border border-white/40 bg-transparent text-white hover:border-white hover:bg-white/10",
} as const;

type Variant = keyof typeof variants;

/** Button styling for elements that aren't Button or ButtonLink, like a plain anchor to a file route. */
export function buttonClass(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  pending,
  pendingLabel,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; pending?: boolean; pendingLabel?: string }) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, className)}
    >
      {pending && <Spinner />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Shared calculator styling (the commission calculator and the buyer cost calculator). */
export const calculatorCardClass = "rounded-3xl border border-line p-6 sm:p-10";
export const rangeInputClass =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";
export const resultTileClass = "rounded-2xl bg-surface p-5";

export function PageHeader({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
      <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
      {children}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function EmptyState({ title, children, actions, footer }: { title: string; children?: ReactNode; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
      {footer && <div className="mx-auto mt-10 max-w-2xl border-t border-line pt-8 text-left">{footer}</div>}
    </div>
  );
}
