"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type Photo = { id: string; url: string };

/** Swipeable photo strip on phones; large cover plus thumbnails on desktop. */
export function ListingGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  if (photos.length === 0) {
    return <div className="aspect-[4/3] w-full rounded-2xl bg-surface sm:aspect-[16/9]" />;
  }

  function go(to: number) {
    const next = (to + photos.length) % photos.length;
    setIndex(next);
    const el = strip.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Listing photos">
      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={strip}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface sm:aspect-[16/9]"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${photos.length}`}
            >
              <Image
                src={photo.url}
                alt={i === 0 ? alt : `${alt}, ${i + 1} of ${photos.length}`}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                sizes="(min-width: 1152px) 1120px, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {photos.length > 1 && (
          <>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink/75 px-2 py-1 text-[13px] font-medium text-white" aria-live="polite">
              {index + 1} / {photos.length}
            </span>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className={arrowClass("left-3")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className={arrowClass("right-3")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <ul className="mt-3 hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {photos.map((photo, i) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index || undefined}
                className={`relative block h-16 w-24 overflow-hidden rounded-lg border-2 ${i === index ? "border-forest" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const arrowClass = (position: string) =>
  `absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow sm:inline-flex hover:bg-white ${position}`;
