"use client";

import { prepareImage } from "@/lib/image";
import type { PhotoJob, PhotoResult } from "@/lib/photo-worker";

type Options = Omit<PhotoJob, "id" | "file">;

/**
 * Workers to run at once. HEIC decoding in WebAssembly is single-threaded per worker, so parallel workers are what
 * make a batch fast on desktop; phones get fewer to keep memory down (they mostly decode natively anyway).
 */
function poolSize() {
  const cores = navigator.hardwareConcurrency || 4;
  const phone = matchMedia("(pointer: coarse)").matches;
  return Math.max(1, Math.min(phone ? 2 : 4, cores - 2));
}

const workerSupported = () => typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined";

let workers: Worker[] | null = null;
let busy: boolean[] = [];
/** Set when a worker fails to start or crashes; every later photo is prepared on the main thread instead. */
let broken = false;
const waiting: (() => void)[] = [];
/** The job each worker is running, so a crash can settle it. */
const current = new Map<number, (result: PhotoResult | null) => void>();

function startPool() {
  workers = Array.from({ length: poolSize() }, (_, index) => {
    const worker = new Worker(new URL("./photo-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<PhotoResult>) => current.get(index)?.(event.data);
    worker.onerror = () => {
      broken = true;
      current.get(index)?.(null);
    };
    return worker;
  });
  busy = workers.map(() => false);
}

async function acquire(): Promise<number> {
  for (;;) {
    const free = busy.indexOf(false);
    if (free >= 0) {
      busy[free] = true;
      return free;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
}

function release(index: number) {
  busy[index] = false;
  waiting.shift()?.();
}

/** Resizes and re-encodes a photo in a worker pool, or on the main thread where workers can't draw. */
export async function preparePhoto(file: File, options: Options): Promise<Blob> {
  if (broken || !workerSupported()) return prepareImage(file, options);
  if (!workers) startPool();
  const index = await acquire();
  let result: PhotoResult | null;
  try {
    result = await new Promise<PhotoResult | null>((resolve) => {
      current.set(index, resolve);
      workers![index].postMessage({ id: crypto.randomUUID(), file, ...options } satisfies PhotoJob);
    });
  } finally {
    current.delete(index);
    release(index);
  }
  if (!result) return prepareImage(file, options);
  if (!result.ok) throw new Error(result.error);
  return result.blob;
}
