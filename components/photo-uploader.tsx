"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { preparePhoto } from "@/lib/photo-pool";
import { LISTING_PHOTO_MAX } from "@/lib/listings";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  url?: string;
  preview?: string;
  status: "queued" | "processing" | "uploading" | "done" | "error";
  /** Upload progress, 0 to 100, while uploading. */
  progress?: number;
  error?: string;
  name: string;
};

export type UploadTarget = { path: string; token: string; publicUrl: string } | { error: string };

type Props = {
  userId: string;
  name: string;
  initialUrls?: string[];
  error?: string;
  onBusyChange?: (busy: boolean) => void;
  /** Called with the uploaded photo URLs, in order, whenever they change. */
  onUrlsChange?: (urls: string[]) => void;
  /**
   * For sellers without an account yet: a route that hands out a signed upload URL per photo (POST), used instead of
   * uploading to the signed-in user's own folder.
   */
  uploadTargetUrl?: string;
  max?: number;
};

/** Photos in flight at once. Decoding is further limited by the worker pool in lib/photo-pool. */
const CONCURRENCY = 4;
/**
 * The stored master for each listing photo: up to 3200px on the long edge, JPEG at about 90% (lower only if a photo is
 * still over the size cap). Visitors never download the master directly; the image optimizer serves each screen a
 * resized copy. JPEGs already within these limits (and not near-lossless) are uploaded without re-encoding.
 */
const PHOTO_OPTIONS = {
  maxDimension: 3200,
  qualities: [0.9, 0.86, 0.82, 0.78],
  // Under the listing-photos bucket's 5 MB limit.
  maxBytes: 4_500_000,
  // About what a quality-95 export of a detailed photo takes; higher means a near-lossless file worth re-encoding.
  passThroughMaxBytesPerPixel: 0.6,
};

/**
 * Uploads a file to Supabase Storage with XMLHttpRequest instead of fetch, which has no upload progress events. Sends
 * the same multipart body supabase-js does. `url` is a signed upload URL, or the object URL with a user's session.
 */
async function requestUploadTarget(url: string): Promise<UploadTarget> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) return { error: "Upload failed. Remove it and try again." };
  return res.json();
}

function uploadWithProgress({ url, method, token, blob, onProgress }: { url: string; method: "POST" | "PUT"; token: string; blob: Blob; onProgress: (percent: number) => void }) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload failed"));
    const body = new FormData();
    body.append("cacheControl", "31536000");
    body.append("", blob);
    xhr.send(body);
  });
}

export function PhotoUploader({ userId, name, initialUrls = [], error, onBusyChange, onUrlsChange, uploadTargetUrl, max = LISTING_PHOTO_MAX }: Props) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url) => ({ id: url, url, status: "done", name: "photo" })),
  );
  const queue = useRef<{ id: string; file: File }[]>([]);
  const [limitNotice, setLimitNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  // On iPhone and iPad, not listing .heic lets iOS hand over JPEGs it converts itself, which is far faster than
  // decoding HEIC in the page. Elsewhere, listing it keeps HEIC files selectable in desktop file pickers.
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios && fileInput.current) fileInput.current.accept = "image/*";
  }, []);
  const active = useRef(0);
  const previews = useRef(new Set<string>());

  const busy = items.some((i) => i.status !== "done" && i.status !== "error");
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  const urlKey = items.flatMap((i) => (i.status === "done" && i.url ? [i.url] : [])).join("\n");
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onUrlsChange?.(urlKey ? urlKey.split("\n") : []);
  }, [urlKey, onUrlsChange]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const update = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function processOne(id: string, file: File) {
    try {
      update(id, { status: "processing" });
      // Ask for the upload URL while the photo is being prepared; the two don't depend on each other.
      const targetRequest = uploadTargetUrl ? requestUploadTarget(uploadTargetUrl) : null;
      targetRequest?.catch(() => {}); // Handled below; don't let an early failure go unobserved.
      const blob = await preparePhoto(file, PHOTO_OPTIONS);
      const preview = URL.createObjectURL(blob);
      previews.current.add(preview);
      update(id, { status: "uploading", preview, progress: 0 });

      const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object`;
      const onProgress = (progress: number) => update(id, { progress });
      const supabase = createClient();
      let publicUrl: string;
      if (targetRequest) {
        const target = await targetRequest;
        if ("error" in target) throw new Error(target.error);
        const url = `${base}/upload/sign/listing-photos/${target.path}?token=${encodeURIComponent(target.token)}`;
        await uploadWithProgress({ url, method: "PUT", token: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", blob, onProgress });
        publicUrl = target.publicUrl;
      } else {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error("Sign in again to upload photos.");
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        await uploadWithProgress({ url: `${base}/listing-photos/${path}`, method: "POST", token: session.access_token, blob, onProgress });
        publicUrl = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
      }
      update(id, { status: "done", url: publicUrl, progress: undefined });
    } catch (e) {
      const message = e instanceof Error && !e.message.startsWith("upload failed") ? e.message : "Upload failed. Remove it and try again.";
      update(id, { status: "error", error: message, progress: undefined });
    }
  }

  function pump() {
    while (active.current < CONCURRENCY && queue.current.length > 0) {
      const next = queue.current.shift()!;
      active.current++;
      processOne(next.id, next.file).finally(() => {
        active.current--;
        pump();
      });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = Math.max(0, max - items.filter((i) => i.status !== "error").length);
    const accepted = Array.from(files).slice(0, room);
    const skipped = files.length - accepted.length;
    setLimitNotice(
      skipped > 0
        ? `A listing can have up to ${max} photos, so ${skipped === 1 ? "1 photo wasn't" : `${skipped} photos weren't`} added. Remove some to make room.`
        : "",
    );
    const added = accepted.map((file) => ({ id: crypto.randomUUID(), file }));
    setItems((prev) => [...prev, ...added.map(({ id, file }) => ({ id, status: "queued" as const, name: file.name }))]);
    queue.current.push(...added);
    pump();
  }

  function remove(id: string) {
    setLimitNotice("");
    queue.current = queue.current.filter((q) => q.id !== id);
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
        previews.current.delete(item.preview);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    if (!over || dragged.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === dragged.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
  }

  const positionOf = (id: string | number) => items.findIndex((i) => i.id === id) + 1;
  const count = items.filter((i) => i.status !== "error").length;
  const full = count >= max;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="block text-[15px] font-medium">Photos</span>
          <p className="mt-1 text-[13px] text-muted">
            Up to {max}. iPhone photos are fine. Drag to reorder (press and hold on a phone); the first photo is the cover.
          </p>
        </div>
        <span className="shrink-0 text-[14px] text-muted" aria-live="polite">
          {count}/{max}
        </span>
      </div>

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: "To reorder a photo, press space to pick it up, use the arrow keys to move it, and press space again to drop it. Press escape to cancel." },
            announcements: {
              onDragStart: ({ active }) => `Picked up photo ${positionOf(active.id)}.`,
              onDragOver: ({ active, over }) => (over ? `Photo ${positionOf(active.id)} is over position ${positionOf(over.id)}.` : `Photo ${positionOf(active.id)} is no longer over a position.`),
              onDragEnd: ({ active, over }) => (over ? `Photo ${positionOf(active.id)} moved to position ${positionOf(over.id)}.` : `Photo ${positionOf(active.id)} dropped.`),
              onDragCancel: ({ active }) => `Moving photo ${positionOf(active.id)} was cancelled.`,
            },
          }}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item, index) => (
                <SortableTile key={item.id} item={item} isCover={index === 0} position={index + 1} onRemove={() => remove(item.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {items
        .filter((i) => i.status === "done" && i.url)
        .map((i) => (
          <input key={i.id} type="hidden" name={name} value={i.url} />
        ))}

      <label
        htmlFor={inputId}
        className={`mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-4 text-center hover:border-forest ${full ? "pointer-events-none opacity-50" : ""}`}
      >
        <span className="text-[15px] font-semibold text-forest">{full ? "Photo limit reached" : items.length ? "Add more photos" : "Choose photos"}</span>
        <span className="mt-1 text-[13px] text-muted">JPEG, PNG, or HEIC</span>
      </label>
      <input
        ref={fileInput}
        id={inputId}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="sr-only"
        disabled={full}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {limitNotice && (
        <p role="alert" className="mt-2 text-[14px] text-red-700">
          {limitNotice}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {busy ? `Uploading photos, ${doneCount} of ${count} done.` : ""}
      </p>
      {error && <p className="mt-2 text-[14px] text-red-700">{error}</p>}
    </div>
  );
}

function SortableTile({ item, isCover, position, onRemove }: { item: Item; isCover: boolean; position: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const src = item.url ?? item.preview;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-[4/3] overflow-hidden rounded-xl border bg-surface ${isDragging ? "z-10 border-forest shadow-lg" : "border-line"} ${item.status === "error" ? "border-red-300" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Photo ${position}${isCover ? ", cover" : ""}. Press space to pick up and use arrow keys to move.`}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      >
        {src && item.status !== "error" && <Image src={src} alt="" fill sizes="(min-width: 640px) 200px, 50vw" className="object-cover" unoptimized={!item.url} />}
        {(item.status === "queued" || item.status === "processing" || item.status === "uploading") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-[13px] text-muted">
            <Spinner />
            {item.status === "uploading" ? `Uploading ${item.progress ?? 0}%` : item.status === "processing" ? "Preparing" : "Waiting"}
            {item.status === "uploading" && (
              <span
                role="progressbar"
                aria-label={`Photo ${position} upload`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.progress ?? 0}
                className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-ink/10"
              >
                <span className="block h-full rounded-full bg-forest transition-[width]" style={{ width: `${item.progress ?? 0}%` }} />
              </span>
            )}
          </div>
        )}
        {item.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[13px] text-red-700">{item.error}</div>
        )}
      </div>
      {isCover && item.status === "done" && (
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-white/95 px-2 py-0.5 text-[12px] font-semibold">Cover</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove photo ${position}`}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow hover:bg-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}
