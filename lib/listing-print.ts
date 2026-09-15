import "server-only";
import { clip, closePath, endPath, lineTo, moveTo, PDFDocument, type PDFFont, type PDFPage, popGraphicsState, pushGraphicsState, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { locationLine, type AreaMarket } from "@/lib/areas";
import { formatPrice, formatSpecs } from "@/lib/listings";
import { brandName, marketUrl, type Market } from "@/lib/markets";

/**
 * Print-ready PDFs a seller can take to a print shop: an 18x24 yard sign and a letter flyer.
 *
 * Both are facts only. Neither carries the street address, and the flyer leaves out the seller's description:
 * a description is where Fair Housing trouble creeps in, and a flyer is handed to people in person.
 */

export type PrintListing = {
  slug: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  city: string;
  zip: string;
};

export type PrintKind = "sign" | "flyer";

const INCH = 72;
const FOREST = rgb(0x1f / 255, 0x4d / 255, 0x3a / 255);
const INK = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255);
const MUTED = rgb(0x5b / 255, 0x5f / 255, 0x5d / 255);
const LINE = rgb(0xe6 / 255, 0xe7 / 255, 0xe5 / 255);
const SURFACE = rgb(0xf6 / 255, 0xf6 / 255, 0xf4 / 255);
const WHITE = rgb(1, 1, 1);

/** The standard fonts only encode Latin-1, so fold the typographic characters our copy uses and drop the rest. */
function safe(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^ -ÿ]/g, "");
}

/** The largest size at or below `max` that fits the width, down to `min`. */
function fitSize(text: string, font: PDFFont, maxWidth: number, max: number, min = 6) {
  let size = max;
  while (size > min && font.widthOfTextAtSize(safe(text), size) > maxWidth) size -= 0.5;
  return size;
}

type TextOptions = { x?: number; y: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb>; centerIn?: [number, number] };

function drawText(page: PDFPage, raw: string, { x, y, size, font, color = INK, centerIn }: TextOptions) {
  const text = safe(raw);
  const left = centerIn ? centerIn[0] + (centerIn[1] - centerIn[0] - font.widthOfTextAtSize(text, size)) / 2 : (x ?? 0);
  page.drawText(text, { x: left, y, size, font, color });
}

/**
 * Draws a QR code as filled rectangles, merging each row's runs of dark modules so the page holds tens of
 * rectangles instead of hundreds. The white square and the two-module inset are the scanner's quiet zone.
 */
async function drawQr(page: PDFPage, url: string, { x, y, size }: { x: number; y: number; size: number }) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const count = modules.size;
  const cell = size / (count + 4);

  page.drawRectangle({ x, y, width: size, height: size, color: WHITE });

  for (let row = 0; row < count; row++) {
    let start = -1;
    for (let col = 0; col <= count; col++) {
      const dark = col < count && modules.data[row * count + col] === 1;
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        page.drawRectangle({
          x: x + cell * (2 + start),
          y: y + size - cell * (2 + row + 1),
          width: (col - start) * cell,
          height: cell,
          color: INK,
        });
        start = -1;
      }
    }
  }
}

type Box = { x: number; y: number; width: number; height: number };

/** Draws an image scaled to cover the box and clipped to it, like CSS object-fit: cover. */
function drawCover(page: PDFPage, image: { width: number; height: number }, draw: (opts: Box) => void, box: Box) {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(box.x, box.y),
    lineTo(box.x + box.width, box.y),
    lineTo(box.x + box.width, box.y + box.height),
    lineTo(box.x, box.y + box.height),
    closePath(),
    clip(),
    endPath(),
  );
  draw({ x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
  page.pushOperators(popGraphicsState());
}

/** Fetches the cover photo and embeds it. Returns null when it's missing, slow, or not a JPEG or PNG. */
async function embedCover(pdf: PDFDocument, url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error(`photo fetch failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    return null;
  } catch (error) {
    console.error("print: cover photo could not be embedded", error);
    return null;
  }
}

async function newDocument(width: number, height: number) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  return { pdf, page, bold, regular };
}

/** 18x24 landscape yard sign: the headline, the price, the market's address, and a QR code. No street address. */
async function buildSign(market: Market, listing: PrintListing) {
  const width = 24 * INCH;
  const height = 18 * INCH;
  const { pdf, page, bold, regular } = await newDocument(width, height);
  const url = marketUrl(market, `/homes/${listing.slug}`);

  page.drawRectangle({ x: 0, y: 0, width, height, color: WHITE });
  page.drawRectangle({ x: 0, y: height - 240, width, height: 240, color: FOREST });
  page.drawRectangle({ x: 0, y: 0, width, height, borderColor: FOREST, borderWidth: 16 });

  const headline = "FOR SALE BY OWNER";
  drawText(page, headline, { y: height - 158, size: fitSize(headline, bold, width - 220, 132), font: bold, color: WHITE, centerIn: [0, width] });

  const textRight = 1120;
  const price = formatPrice(listing.price);
  drawText(page, price, { x: 110, y: 600, size: fitSize(price, bold, textRight - 110, 230), font: bold, color: INK });

  const domain = `www.${market.domain}`;
  drawText(page, domain, { x: 110, y: 450, size: fitSize(domain, bold, textRight - 110, 104), font: bold, color: FOREST });

  const prompt = "Scan the code for photos and to reach the owner.";
  drawText(page, prompt, { x: 110, y: 372, size: fitSize(prompt, regular, textRight - 110, 44), font: regular, color: MUTED });

  const qr = 440;
  const qrX = width - 120 - qr;
  const qrY = (height - 240 - qr) / 2;
  page.drawRectangle({ x: qrX - 20, y: qrY - 20, width: qr + 40, height: qr + 40, color: SURFACE });
  await drawQr(page, url, { x: qrX, y: qrY, size: qr });
  drawText(page, "SCAN FOR DETAILS", { y: qrY - 62, size: 34, font: bold, color: MUTED, centerIn: [qrX, qrX + qr] });

  return pdf.save();
}

/** Letter flyer: cover photo, price, the facts, a QR code, the listing address, and the brand footer. */
async function buildFlyer(market: Market, listing: PrintListing, coverUrl: string | null) {
  const width = 8.5 * INCH;
  const height = 11 * INCH;
  const { pdf, page, bold, regular } = await newDocument(width, height);
  const url = marketUrl(market, `/homes/${listing.slug}`);
  const margin = 48;
  const brand = brandName(market);

  page.drawRectangle({ x: 0, y: 0, width, height, color: WHITE });

  // Cover photo across the top, cropped to fill. Without one, a plain panel keeps the layout intact.
  const photoBox = { x: 0, y: height - 340, width, height: 340 };
  const cover = await embedCover(pdf, coverUrl);
  if (cover) {
    drawCover(page, cover, (opts) => page.drawImage(cover, opts), photoBox);
  } else {
    page.drawRectangle({ ...photoBox, color: SURFACE });
    drawText(page, brand, { y: photoBox.y + 160, size: 30, font: bold, color: FOREST, centerIn: [0, width] });
  }

  const price = formatPrice(listing.price);
  drawText(page, price, { x: margin, y: 400, size: fitSize(price, bold, width - margin * 2, 46), font: bold, color: INK });
  drawText(page, formatSpecs(listing), { x: margin, y: 370, size: 17, font: regular, color: INK });
  drawText(page, locationLine(market as AreaMarket, listing.zip, listing.city), { x: margin, y: 346, size: 14, font: regular, color: MUTED });

  page.drawLine({ start: { x: margin, y: 322 }, end: { x: width - margin, y: 322 }, thickness: 1, color: LINE });

  const qr = 150;
  const qrX = width - margin - qr;
  const qrY = 150;
  await drawQr(page, url, { x: qrX, y: qrY, size: qr });
  drawText(page, "SCAN FOR PHOTOS", { y: qrY - 22, size: 9, font: bold, color: MUTED, centerIn: [qrX, qrX + qr] });

  const textWidth = qrX - margin - 28;
  drawText(page, "See every photo and contact the owner:", { x: margin, y: 280, size: 12, font: regular, color: MUTED });
  const shortUrl = url.replace(/^https?:\/\//, "");
  drawText(page, shortUrl, { x: margin, y: 258, size: fitSize(shortUrl, bold, textWidth, 13, 7), font: bold, color: FOREST });
  drawText(page, "Listed by the owner, with no agent in between.", { x: margin, y: 224, size: 12, font: regular, color: INK });
  drawText(page, `Details come from the owner and aren't verified by ${brand}.`, { x: margin, y: 118, size: 8.5, font: regular, color: MUTED });

  page.drawRectangle({ x: 0, y: 0, width, height: 72, color: FOREST });
  drawText(page, `Listed on ${brand}`, { y: 42, size: 20, font: bold, color: WHITE, centerIn: [0, width] });
  drawText(page, `www.${market.domain}`, { y: 22, size: 12, font: regular, color: WHITE, centerIn: [0, width] });

  return pdf.save();
}

export function buildListingPdf(kind: PrintKind, market: Market, listing: PrintListing, coverUrl: string | null) {
  return kind === "sign" ? buildSign(market, listing) : buildFlyer(market, listing, coverUrl);
}

/** A filename a seller will recognize in their downloads folder. */
export function printFileName(kind: PrintKind, market: Market, listing: PrintListing) {
  const place = `${listing.city}-${listing.zip}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${market.slug}-${place}-${kind === "sign" ? "yard-sign-18x24" : "flyer-letter"}.pdf`;
}
