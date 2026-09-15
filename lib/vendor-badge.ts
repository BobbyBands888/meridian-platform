import type { VendorCategoryValue } from "@/lib/database.types";
import { brandName, marketUrl, type Market } from "@/lib/markets";
import { vendorPath } from "@/lib/vendors";

/**
 * The "Listed on Nashville Buys" badge vendors embed on their own site, with a link back to their profile.
 * The image is plain SVG served from /badge/<vendor id> on the market's own domain, so it needs no fonts,
 * no scripts, and no build step. Everything here is market-aware: Tampa vendors get a Tampa Buys badge.
 */

export type BadgeVendor = { id: string; category: VendorCategoryValue; business_name: string; verified_at?: string | null };

const PAD = 16;
const MARK = 24;
const GAP = 11;
const HEIGHT = 64;

const EYEBROW_SIZE = 11;
const BRAND_SIZE = 17;

/**
 * Rough advance width for the badge's system font stack, in pixels. It only decides how wide the box is drawn:
 * the text is left-aligned with padding to spare, so a few pixels either way on another platform is invisible.
 */
function textWidth(text: string, fontSize: number, bold: boolean, letterSpacing = 0) {
  const em = bold ? 0.6 : 0.53;
  return text.length * (fontSize * em + letterSpacing);
}

export const badgePath = (vendor: Pick<BadgeVendor, "id">) => `/badge/${vendor.id}`;

export function badgeLabel(market: Pick<Market, "name">, verified: boolean) {
  return `${verified ? "Verified" : "Listed"} on ${brandName(market)}`;
}

export function badgeSize(market: Pick<Market, "name">, verified: boolean) {
  const eyebrow = verified ? "VERIFIED ON" : "LISTED ON";
  const text = Math.max(textWidth(eyebrow, EYEBROW_SIZE, true, 0.9), textWidth(brandName(market), BRAND_SIZE, true));
  return { width: Math.round(PAD + MARK + GAP + text + PAD), height: HEIGHT };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function badgeSvg(market: Pick<Market, "name">, verified: boolean) {
  const { width, height } = badgeSize(market, verified);
  const label = badgeLabel(market, verified);
  const textX = PAD + MARK + GAP;
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">
  <title>${escape(label)}</title>
  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="11.25" fill="#ffffff" stroke="#e6e7e5" stroke-width="1.5"/>
  <circle cx="${PAD + MARK / 2}" cy="${height / 2}" r="${MARK / 2}" fill="#1f4d3a"/>
  <path d="M${PAD + 7} ${height / 2} l4 4 l7 -8" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${textX}" y="26" font-family="${font}" font-size="${EYEBROW_SIZE}" font-weight="700" letter-spacing="0.9" fill="#5b5f5d">${verified ? "VERIFIED ON" : "LISTED ON"}</text>
  <text x="${textX}" y="47" font-family="${font}" font-size="${BRAND_SIZE}" font-weight="700" fill="#1f4d3a">${escape(brandName(market))}</text>
</svg>
`;
}

/** The absolute URLs a vendor pastes into their own site: the profile they link to, and the badge image. */
export function badgeUrls(market: Pick<Market, "name" | "domain">, vendor: BadgeVendor) {
  return { profileUrl: marketUrl(market, vendorPath(vendor)), imageUrl: marketUrl(market, badgePath(vendor)) };
}

/** The copyable HTML embed. rel="dofollow" is what vendors are told to keep, so the link passes link equity. */
export function badgeEmbedHtml(market: Pick<Market, "name" | "domain">, vendor: BadgeVendor) {
  const { profileUrl, imageUrl } = badgeUrls(market, vendor);
  const verified = Boolean(vendor.verified_at);
  const { width, height } = badgeSize(market, verified);
  return [
    `<a href="${profileUrl}" rel="dofollow">`,
    `  <img src="${imageUrl}" alt="${badgeLabel(market, verified)}" width="${width}" height="${height}" loading="lazy">`,
    `</a>`,
  ].join("\n");
}
