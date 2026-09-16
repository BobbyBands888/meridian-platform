"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Photo = { id: string; url: string };

/** Photos this far either side of the current one are loaded ahead of time; the rest wait until they're near. */
const PRELOAD = 1;
/** Thumbnails past the visible part of the row that load ahead, so scrolling the row doesn't show blanks. */
const THUMB_AHEAD = 6;

/**
 * Listing photos: a swipeable strip with a counter and a thumbnail row, plus a full-screen viewer. Built for up to
 * 50 photos on a phone: slides only render their image once the visitor gets near them, and thumbnails lazy-load.
 */
export function ListingGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  // Indexes whose full-size image has been requested, in either view. Once loaded, an image stays mounted.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));
  const strip = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbs = useRef<HTMLUListElement>(null);
  // Thumbnails load as the row scrolls near them. Browser lazy-loading doesn't hold back images in a horizontal row.
  const [thumbsThrough, setThumbsThrough] = useState(8);
  const revealThumbs = useCallback(() => {
    const row = thumbs.current;
    const first = row?.children[0] as HTMLElement | undefined;
    if (!row || !first) return;
    const perThumb = first.offsetWidth + 8;
    const last = Math.ceil((row.scrollLeft + row.clientWidth) / perThumb) + THUMB_AHEAD;
    setThumbsThrough((n) => Math.max(n, last));
  }, []);
  useEffect(revealThumbs, [revealThumbs]);

  const reveal = useCallback(
    (i: number) =>
      setSeen((prev) => {
        const wanted = [];
        for (let j = i - PRELOAD; j <= i + PRELOAD; j++) if (j >= 0 && j < photos.length && !prev.has(j)) wanted.push(j);
        return wanted.length ? new Set([...prev, ...wanted]) : prev;
      }),
    [photos.length],
  );

  const scrollTo = (el: HTMLElement | null, i: number, smooth = true) => el?.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "instant" });

  function go(to: number) {
    const next = (to + photos.length) % photos.length;
    setIndex(next);
    reveal(next);
    scrollTo(strip.current, next);
    if (open) scrollTo(viewer.current, next);
  }

  // Keep the active thumbnail in view. Scrolls only the thumbnail row (scrollIntoView could also move the page).
  useEffect(() => {
    const row = thumbs.current;
    const thumb = row?.children[index] as HTMLElement | undefined;
    if (!row || !thumb) return;
    const left = thumb.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + thumb.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: left - (row.clientWidth - thumb.offsetWidth) / 2, behavior: "smooth" });
    }
    setThumbsThrough((n) => Math.max(n, index + THUMB_AHEAD));
  }, [index]);

  function openViewer() {
    setOpen(true);
    dialog.current?.showModal();
    // Jump straight to the current photo once the dialog has laid out.
    requestAnimationFrame(() => scrollTo(viewer.current, index, false));
  }

  function closeViewer() {
    dialog.current?.close();
  }

  // Swiping either view updates the index; the other view catches up when it's shown (open or close).
  const onStripScroll = (el: HTMLDivElement) => {
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < photos.length) {
      setIndex(i);
      reveal(i);
    }
  };

  if (photos.length === 0) {
    return <div className="aspect-[4/3] w-full rounded-2xl bg-surface sm:aspect-[16/9]" />;
  }

  const counter = `${index + 1} / ${photos.length}`;

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Listing photos">
      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={strip}
          onScroll={(e) => onStripScroll(e.currentTarget)}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface sm:aspect-[16/9]"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${photos.length}`}
            >
              {seen.has(i) && (
                <button type="button" onClick={openViewer} aria-label={`Open photo ${i + 1} full screen`} className="absolute inset-0 cursor-zoom-in">
                  <Image
                    src={photo.url}
                    alt={i === 0 ? alt : `${alt}, ${i + 1} of ${photos.length}`}
                    fill
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    sizes="(min-width: 1152px) 1120px, 100vw"
                    className="object-cover"
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-ink/75 px-2 py-1 text-[13px] font-medium text-white" aria-live="polite">
          {counter}
        </span>
        <button
          type="button"
          onClick={openViewer}
          className="absolute bottom-3 left-3 rounded-md bg-white/95 px-3 py-1.5 text-[13px] font-semibold text-ink shadow hover:bg-white"
        >
          {photos.length > 1 ? `View all ${photos.length}` : "Full screen"}
        </button>
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className={arrowClass("left-3", "hidden sm:inline-flex")}>
              <Chevron direction="left" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className={arrowClass("right-3", "hidden sm:inline-flex")}>
              <Chevron direction="right" />
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <ul ref={thumbs} onScroll={revealThumbs} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {photos.map((photo, i) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index || undefined}
                className={`relative block h-12 w-16 overflow-hidden rounded-lg border-2 sm:h-16 sm:w-24 ${i === index ? "border-forest" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                {i <= thumbsThrough ? <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" /> : <span className="absolute inset-0 bg-surface" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-label="Listing photos, full screen"
        onClose={() => {
          setOpen(false);
          scrollTo(strip.current, index, false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      >
        {open && (
          <div className="relative h-full w-full">
            <div
              ref={viewer}
              onScroll={(e) => onStripScroll(e.currentTarget)}
              className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((photo, i) => (
                <div key={photo.id} className="relative h-full w-full shrink-0 snap-center" aria-label={`${i + 1} of ${photos.length}`}>
                  {seen.has(i) && <Image src={photo.url} alt={`${alt}, ${i + 1} of ${photos.length}`} fill sizes="100vw" className="object-contain" />}
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3">
              <span className="text-[15px] font-medium" aria-live="polite">
                {counter}
              </span>
              <button
                type="button"
                onClick={closeViewer}
                aria-label="Close full screen"
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className={arrowClass("left-3", "hidden sm:inline-flex")}>
                  <Chevron direction="left" />
                </button>
                <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className={arrowClass("right-3", "hidden sm:inline-flex")}>
                  <Chevron direction="right" />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

const arrowClass = (position: string, display: string) =>
  `absolute top-1/2 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow hover:bg-white ${display} ${position}`;
