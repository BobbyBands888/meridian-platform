// Reads and rewrites JPEG structure without decoding pixels, so a well-prepared JPEG can be uploaded with its image
// data byte-for-byte unchanged. Runs in the photo worker; no DOM.

export type JpegInfo = {
  width: number;
  height: number;
  /** 1 grayscale, 3 YCbCr/RGB, 4 CMYK (browsers render CMYK badly). */
  components: number;
  /** EXIF orientation (1 = upright), or null when there's no EXIF. */
  orientation: number | null;
};

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const startsWith = (bytes: Uint8Array, at: number, text: string) => [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0));

type Segment = { marker: number; start: number; end: number };

/** Header segments up to the first scan, plus where the scan data starts. Null if this isn't a readable JPEG. */
function segments(bytes: Uint8Array): { list: Segment[]; scanStart: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const list: Segment[] = [];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return null;
    if (marker === 0xda) return { list, scanStart: i };
    list.push({ marker, start: i, end: i + 2 + length });
    i += 2 + length;
  }
  return null;
}

function exifOrientation(bytes: Uint8Array, seg: Segment): number | null {
  const tiff = seg.start + 10; // FF E1, length (2), "Exif\0\0" (6)
  if (!startsWith(bytes, seg.start + 4, "Exif\0\0") || tiff + 8 > seg.end) return null;
  const little = bytes[tiff] === 0x49;
  const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number) => (little ? u16(at) + u16(at + 2) * 65536 : u16(at) * 65536 + u16(at + 2));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > seg.end) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > seg.end) return null;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return null;
}

export function readJpeg(bytes: Uint8Array): JpegInfo | null {
  const parsed = segments(bytes);
  if (!parsed) return null;
  let info: Omit<JpegInfo, "orientation"> | null = null;
  let orientation: number | null = null;
  for (const seg of parsed.list) {
    if (SOF.has(seg.marker)) {
      info = { height: (bytes[seg.start + 5] << 8) | bytes[seg.start + 6], width: (bytes[seg.start + 7] << 8) | bytes[seg.start + 8], components: bytes[seg.start + 9] };
    } else if (seg.marker === 0xe1 && orientation === null) {
      orientation = exifOrientation(bytes, seg);
    }
  }
  return info && info.width > 0 && info.height > 0 ? { ...info, orientation } : null;
}

/**
 * The same JPEG with every metadata segment removed: EXIF (including GPS and camera details), XMP, IPTC/Photoshop,
 * comments, and anything appended after the image (iPhone depth and HDR gain maps). Keeps what affects how it looks:
 * JFIF, the ICC color profile, the Adobe color-transform marker, and the image data itself, unchanged.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  const parsed = segments(bytes);
  if (!parsed) return null;
  const keep = (seg: Segment) => {
    const m = seg.marker;
    if (m === 0xfe) return false; // comment
    if (m === 0xe0) return startsWith(bytes, seg.start + 4, "JFIF\0");
    if (m === 0xe2) return startsWith(bytes, seg.start + 4, "ICC_PROFILE\0");
    if (m === 0xee) return startsWith(bytes, seg.start + 4, "Adobe");
    if (m >= 0xe1 && m <= 0xef) return false; // EXIF, XMP, MPF, IPTC, and other application data
    return true; // tables, frame header, restart interval
  };

  // The image ends at the first EOI after the scans (0xFF bytes inside scan data are always stuffed or restart
  // markers, so FF D9 only appears as the real end). Anything after it is a secondary image or trailing metadata.
  let end = -1;
  for (let i = parsed.scanStart; i + 1 < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      end = i + 2;
      break;
    }
  }
  if (end < 0) return null;

  const kept = parsed.list.filter(keep);
  const size = 2 + kept.reduce((n, s) => n + (s.end - s.start), 0) + (end - parsed.scanStart);
  const out = new Uint8Array(size);
  out[0] = 0xff;
  out[1] = 0xd8;
  let at = 2;
  for (const seg of kept) {
    out.set(bytes.subarray(seg.start, seg.end), at);
    at += seg.end - seg.start;
  }
  out.set(bytes.subarray(parsed.scanStart, end), at);
  return out;
}

const DISPLAY_P3_ASCII = Uint8Array.from("Display P3", (c) => c.charCodeAt(0));
const DISPLAY_P3_UTF16 = Uint8Array.from([..."Display P3"].flatMap((c) => [0, c.charCodeAt(0)]));

function indexOf(haystack: Uint8Array, needle: Uint8Array) {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** True when a HEIC file's color profile is Display P3 (every iPhone photo), from its ICC or nclx color box. */
export function heicIsDisplayP3(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1_000_000); // color boxes sit in the metadata near the start
  for (let i = 0; i + 16 < limit; i++) {
    if (bytes[i] !== 0x63 || !startsWith(bytes, i, "colr")) continue;
    if (startsWith(bytes, i + 4, "nclx")) return ((bytes[i + 8] << 8) | bytes[i + 9]) === 12; // P3-D65 primaries
    if (startsWith(bytes, i + 4, "prof") || startsWith(bytes, i + 4, "rICC")) {
      // The profile's "desc" names it, as UTF-16 (mluc, what iPhones write) or ASCII.
      const icc = bytes.subarray(i + 8, Math.min(i + 8 + 8000, bytes.length));
      return indexOf(icc, DISPLAY_P3_UTF16) >= 0 || indexOf(icc, DISPLAY_P3_ASCII) >= 0;
    }
  }
  return false;
}
