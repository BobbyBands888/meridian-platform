import type { VendorCategoryValue } from "@/lib/database.types";
import { plannedVendorCategories, vendorCategories, type ModuleCategory } from "@/lib/site";

export type VendorCategoryInfo = (typeof vendorCategories)[number];

export function categoryBySlug(slug: string) {
  return vendorCategories.find((c) => c.slug === slug);
}

export function categoryByValue(value: VendorCategoryValue) {
  return vendorCategories.find((c) => c.value === value)!;
}

/** True for categories the directory accepts; false for planned trades. */
export function isDirectoryCategory(value: ModuleCategory): value is VendorCategoryValue {
  return vendorCategories.some((c) => c.value === value);
}

/** Label details for a directory or planned category, and whether vendors can join it yet. */
export function moduleCategoryInfo(value: ModuleCategory) {
  const directory = vendorCategories.find((c) => c.value === value);
  if (directory) return { ...directory, joinable: true };
  return { ...plannedVendorCategories.find((c) => c.value === value)!, joinable: false };
}

/** How sentences name a category's vendors ("closing attorneys and title companies"), where the label reads awkwardly. */
const SENTENCE_NAMES: Partial<Record<ModuleCategory, { plural: string; singular: string }>> = {
  attorney: { plural: "closing attorneys and title companies", singular: "closing attorney or title company" },
  home_insurance: { plural: "home insurance agents", singular: "home insurance agent" },
  hvac: { plural: "HVAC pros", singular: "HVAC pro" },
  pest_control: { plural: "pest and termite control pros", singular: "pest and termite control pro" },
  foundation_repair: { plural: "foundation and crawlspace pros", singular: "foundation and crawlspace pro" },
};

export function categorySentenceName(value: ModuleCategory) {
  const info = moduleCategoryInfo(value);
  return SENTENCE_NAMES[value] ?? { plural: info.label.toLowerCase(), singular: info.singular.toLowerCase() };
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
