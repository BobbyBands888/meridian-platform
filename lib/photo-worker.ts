// Web Worker: turns one picked photo into an upload-ready JPEG off the main thread.
//
// * A JPEG that's already a sensible size (a photographer's export, say) is uploaded as-is: its image data is kept
//   byte-for-byte and only metadata is removed (EXIF, GPS, XMP, IPTC, comments), so there's no second round of
//   compression. Its ICC color profile stays.
// * Everything else is decoded and re-encoded as an sRGB JPEG master. The browser's own decoder is tried first (Safari
//   decodes HEIC natively, every browser decodes JPEG/PNG/WebP); HEIC falls back to heic-to's WebAssembly decoder,
//   which is slow, so the pool runs several of these side by side. Re-encoding through a canvas drops all metadata.

import { heicIsDisplayP3, readJpeg, stripJpegMetadata } from "@/lib/jpeg";

export type PhotoJob = {
  id: string;
  file: Blob;
  maxDimension: number;
  maxBytes: number;
  qualities: number[];
  /** A JPEG at or under maxDimension, maxBytes, and this density is uploaded without re-encoding. */
  passThroughMaxBytesPerPixel: number;
};
export type PhotoResult =
  | { id: string; ok: true; blob: Blob; passedThrough: boolean }
  | { id: string; ok: false; error: string };

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

function isHeic(file: Blob, bytes: Uint8Array) {
  if (/image\/hei[cf]/i.test(file.type)) return true;
  const ascii = String.fromCharCode(...bytes.subarray(0, 12));
  return ascii.slice(4, 8) === "ftyp" && HEIC_BRANDS.includes(ascii.slice(8, 12));
}

/** The JPEG with metadata stripped, if it can go up without re-encoding. */
function passThrough(bytes: Uint8Array, job: PhotoJob): Blob | null {
  const info = readJpeg(bytes);
  if (!info) return null;
  // CMYK renders inconsistently in browsers, and a rotation flag would be lost with the EXIF, so those get re-encoded.
  if (info.components === 4 || (info.orientation !== null && info.orientation !== 1)) return null;
  if (Math.max(info.width, info.height) > job.maxDimension) return null;
  const stripped = stripJpegMetadata(bytes);
  if (!stripped || stripped.length > job.maxBytes) return null;
  // Very high-quality exports (near-lossless) are re-encoded to keep storage and bandwidth in line with other photos.
  if (stripped.length / (info.width * info.height) > job.passThroughMaxBytesPerPixel) return null;
  return new Blob([stripped as BlobPart], { type: "image/jpeg" });
}

/**
 * libheif (inside heic-to) returns the file's raw pixel values without applying its color profile, and the browser
 * then treats them as sRGB, which washes out iPhone photos (Display P3). This re-labels the pixels as Display P3 so
 * drawing them onto an sRGB canvas converts the colors properly.
 */
async function tagAsDisplayP3(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const raw = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d");
  const p3 = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d", { colorSpace: "display-p3" });
  // getContextAttributes isn't in TypeScript's OffscreenCanvas types yet. Browsers without wide-color canvases keep the old colors.
  const attributes = (p3 as unknown as { getContextAttributes?: () => { colorSpace?: string } } | null)?.getContextAttributes?.();
  if (!raw || !p3 || attributes?.colorSpace !== "display-p3") return bitmap;
  raw.drawImage(bitmap, 0, 0);
  const pixels = raw.getImageData(0, 0, bitmap.width, bitmap.height);
  p3.putImageData(new ImageData(pixels.data, bitmap.width, bitmap.height, { colorSpace: "display-p3" }), 0, 0);
  bitmap.close();
  return createImageBitmap(p3.canvas);
}

async function decode(file: Blob, bytes: Uint8Array) {
  try {
    return { bitmap: await createImageBitmap(file, { imageOrientation: "from-image" }), wasm: false };
  } catch (error) {
    if (!isHeic(file, bytes)) throw error;
    const { heicTo } = await import("heic-to/csp");
    return { bitmap: await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } }), wasm: true };
  }
}

async function prepare(job: PhotoJob): Promise<{ blob: Blob; passedThrough: boolean }> {
  const bytes = new Uint8Array(await job.file.arrayBuffer());
  const original = passThrough(bytes, job);
  if (original) return { blob: original, passedThrough: true };

  const decoded = await decode(job.file, bytes);
  let bitmap = decoded.bitmap;
  try {
    let dimension = job.maxDimension;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      // The browser's resampler (off the main thread) is faster and smoother than drawImage scaling a 12MP bitmap.
      let resized = scale < 1 ? await createImageBitmap(bitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" }) : bitmap;
      // Fix colors after resizing, so the pixel copy is of the 3200px image rather than the full-size one.
      if (decoded.wasm && heicIsDisplayP3(bytes)) {
        if (resized === bitmap) bitmap = await createImageBitmap(bitmap); // keep the original for a smaller retry
        resized = await tagAsDisplayP3(resized);
      }
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d", { colorSpace: "srgb" });
      if (!ctx) throw new Error("Your browser couldn't process that image.");
      ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(resized, 0, 0);
      if (resized !== bitmap) resized.close();
      for (const quality of job.qualities) {
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= job.maxBytes) return { blob, passedThrough: false };
      }
      dimension = Math.round(dimension * 0.75);
    }
    throw new Error("That image is too large to compress. Try a smaller photo.");
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent<PhotoJob>) => {
  const job = event.data;
  try {
    const { blob, passedThrough } = await prepare(job);
    self.postMessage({ id: job.id, ok: true, blob, passedThrough } satisfies PhotoResult);
  } catch (e) {
    const message = e instanceof Error && e.message.startsWith("That image") ? e.message : "We couldn't read that image. Try a JPEG or PNG.";
    self.postMessage({ id: job.id, ok: false, error: message } satisfies PhotoResult);
  }
};
