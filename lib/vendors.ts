import type { VendorCategoryValue } from "@/lib/database.types";
import { vendorCategories } from "@/lib/site";

export type VendorCategoryInfo = (typeof vendorCategories)[number];

export function categoryBySlug(slug: string) {
  return vendorCategories.find((c) => c.slug === slug);
}

export function categoryByValue(value: VendorCategoryValue) {
  return vendorCategories.find((c) => c.value === value)!;
}

export function vendorPath(vendor: { id: string; category: VendorCategoryValue }) {
  return `/vendors/${categoryByValue(vendor.category).slug}/${vendor.id}`;
}

export const BIO_MAX = 400;

/** Counts sentences ending in . ! or ? that have at least two words. */
export function countSentences(text: string) {
  return (text.match(/[^.!?]+[.!?]+/g) ?? []).filter((s) => s.trim().split(/\s+/).length >= 2).length;
}

/** First sentence, for one-line card summaries. */
export function firstSentence(text: string) {
  const match = text.trim().match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

/** Adds https:// when missing. Returns null for an empty value and "invalid" when it can't be a web address. */
export function normalizeWebsite(input: string): string | null | "invalid" {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!url.hostname.includes(".") || !["http:", "https:"].includes(url.protocol)) return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

/** A headshot URL is only accepted from the signed-in user's own folder in the vendor-headshots bucket. */
export function isOwnHeadshotUrl(url: string, userId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/vendor-headshots/${userId}/`) && !url.includes("..");
}
