// Web Worker: turns one picked photo into an upload-ready JPEG off the main thread. The browser's own decoder is
// tried first (Safari decodes HEIC natively, and every browser decodes JPEG/PNG/WebP); HEIC falls back to heic-to's
// WebAssembly decoder, which is slow (seconds per 12MP photo), so the pool runs several of these side by side.
// Re-encoding through a canvas drops all EXIF, including GPS.

export type PhotoJob = { id: string; file: Blob; maxDimension: number; maxBytes: number; qualities: number[] };
export type PhotoResult =
  | { id: string; ok: true; blob: Blob }
  | { id: string; ok: false; error: string };

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

async function isHeic(file: Blob) {
  if (/image\/hei[cf]/i.test(file.type)) return true;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...header);
  return ascii.slice(4, 8) === "ftyp" && HEIC_BRANDS.includes(ascii.slice(8, 12));
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    if (!(await isHeic(file))) throw error;
    const { heicTo } = await import("heic-to/csp");
    return heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  }
}

async function prepare({ file, maxDimension, maxBytes, qualities }: PhotoJob) {
  const bitmap = await decode(file);
  try {
    let dimension = maxDimension;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      // The browser's resampler (off the main thread) is faster and smoother than drawImage scaling a 12MP bitmap.
      const resized = scale < 1 ? await createImageBitmap(bitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" }) : bitmap;
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't process that image.");
      ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(resized, 0, 0);
      if (resized !== bitmap) resized.close();
      for (const quality of qualities) {
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= maxBytes) return blob;
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
    const blob = await prepare(job);
    self.postMessage({ id: job.id, ok: true, blob } satisfies PhotoResult);
  } catch (e) {
    const message = e instanceof Error && e.message.startsWith("That image") ? e.message : "We couldn't read that image. Try a JPEG or PNG.";
    self.postMessage({ id: job.id, ok: false, error: message } satisfies PhotoResult);
  }
};
