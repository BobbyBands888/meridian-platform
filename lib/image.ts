// Client-side photo preparation: HEIC to JPEG, orientation fix, resize, and compression before upload.

type PrepareOptions = { maxDimension: number; maxBytes: number };

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

/** Detects HEIC/HEIF by file signature, since iOS and some browsers report an empty or generic MIME type. */
async function isHeicFile(file: File) {
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...header);
  return ascii.slice(4, 8) === "ftyp" && HEIC_BRANDS.includes(ascii.slice(8, 12));
}

async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // <img> decoding applies EXIF orientation.
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), "image/jpeg", quality),
  );
}

export async function prepareImage(file: File, { maxDimension, maxBytes }: PrepareOptions): Promise<Blob> {
  let source: Blob = file;
  if (await isHeicFile(file)) {
    const { heicTo } = await import("heic-to/next");
    source = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  } else if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }

  let img: HTMLImageElement;
  try {
    img = await decode(source);
  } catch {
    throw new Error("We couldn't read that image. Try a JPEG or PNG.");
  }

  let dimension = maxDimension;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, dimension / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process that image.");
    ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const blob = await toJpeg(canvas, quality);
      if (blob.size <= maxBytes) return blob;
    }
    dimension = Math.round(dimension * 0.75);
  }
  throw new Error("That image is too large to compress. Try a smaller photo.");
}
