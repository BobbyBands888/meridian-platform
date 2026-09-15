import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type PhotoCardProps = {
  href: string;
  imageUrl?: string | null;
  imageAlt: string;
  /** Anchor the crop to the top for headshots so faces aren't cut off. */
  imagePosition?: "center" | "top";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  checks?: string[];
  action?: ReactNode;
  priority?: boolean;
};

/** The one card style used for listings and vendors everywhere on the site. */
export function PhotoCard({
  href,
  imageUrl,
  imageAlt,
  imagePosition = "center",
  eyebrow,
  title,
  subtitle,
  meta,
  checks,
  action,
  priority,
}: PhotoCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_8px_30px_rgba(17,17,17,0.08)]">
      <Link href={href} className="flex flex-1 flex-col focus-visible:outline-none">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
              className={`object-cover transition-transform duration-500 group-hover:scale-[1.02] ${imagePosition === "top" ? "object-top" : ""}`}
            />
          ) : (
            <PhotoPlaceholder />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-5">
          {eyebrow && <p className="text-[13px] font-medium text-forest">{eyebrow}</p>}
          <h3 className="text-xl font-semibold leading-snug tracking-tight group-hover:underline group-focus-visible:underline">
            {title}
          </h3>
          {subtitle && <p className="text-[15px] leading-relaxed text-muted">{subtitle}</p>}
          {meta && <div className="text-[15px] text-ink">{meta}</div>}
          {checks && checks.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {checks.map((check) => (
                <li key={check}>
                  <Check label={check} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
      {action && <div className="px-5 pb-5">{action}</div>}
    </article>
  );
}

/** Quiet trust mark: a small forest-green checkmark and label. */
export function Check({ label }: { label: string }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-[13px] leading-snug text-muted">
      <svg className="mt-[2px] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1f4d3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      {label}
    </span>
  );
}

function PhotoPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center text-line">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5L12 3l9 7.5V21H3z" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    </div>
  );
}

export function PhotoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white" aria-hidden="true">
      <div className="aspect-[4/3] w-full animate-pulse bg-surface" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-surface" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface" />
      </div>
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function CardGridSkeleton({ count = 6, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <CardGrid>
        {Array.from({ length: count }, (_, i) => (
          <PhotoCardSkeleton key={i} />
        ))}
      </CardGrid>
    </div>
  );
}
