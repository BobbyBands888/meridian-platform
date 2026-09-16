// Client-side photo preparation: HEIC to JPEG, orientation fix, resize, and compression before upload.

type PrepareOptions = {
  maxDimension: number;
  maxBytes: number;
  /** JPEG qualities to try in order until the file fits under maxBytes. */
  qualities?: number[];
};
type Source = { image: CanvasImageSource; width: number; height: number; close?: () => void };

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

/** Detects HEIC/HEIF by file signature, since iOS and some browsers report an empty or generic MIME type. */
async function isHeicFile(file: File) {
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...header);
  return ascii.slice(4, 8) === "ftyp" && HEIC_BRANDS.includes(ascii.slice(8, 12));
}

/**
 * Decodes with createImageBitmap, which keeps working while the tab is in the background (a seller switching
 * apps mid-upload). <img>.decode() stalls in hidden tabs, so it's only the fallback for older browsers.
 */
async function decode(blob: Blob): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to <img> decoding.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // <img> decoding applies EXIF orientation.
    return { image: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), "image/jpeg", quality),
  );
}

export async function prepareImage(file: File, { maxDimension, maxBytes, qualities = [0.85, 0.75, 0.65, 0.55] }: PrepareOptions): Promise<Blob> {
  let source: Source;
  try {
    if (await isHeicFile(file)) {
      const { heicTo } = await import("heic-to/next");
      const bitmap = await heicTo({ blob: file, type: "bitmap" });
      source = { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } else if (file.type.startsWith("image/") || file.type === "") {
      source = await decode(file);
    } else {
      throw new Error("not-image");
    }
  } catch (e) {
    throw new Error(e instanceof Error && e.message === "not-image" ? "That file isn't an image." : "We couldn't read that image. Try a JPEG or PNG.");
  }

  try {
    let dimension = maxDimension;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, dimension / Math.max(source.width, source.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't process that image.");
      ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const blob = await toJpeg(canvas, quality);
        if (blob.size <= maxBytes) return blob;
      }
      dimension = Math.round(dimension * 0.75);
    }
    throw new Error("That image is too large to compress. Try a smaller photo.");
  } finally {
    source.close?.();
  }
}
