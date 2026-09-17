// Where buyers come from. Two separate things, both first-party:
// * Page source: the site page a lead or signup came from (a buyer tool, the /buy page, an empty vendor module). Internal
//   links carry it as ?s=<page source>.
// * First source: the first outside ?s= value a visitor arrived with (reddit, fbgroup, text, ...). The proxy keeps it
//   for 30 days in the nb_fs cookie and never overwrites it. Page sources are never stored as a first source, so
//   clicking around the site doesn't replace where someone really came from.
// No third-party trackers. Shared by the proxy, server actions, and client components, so no server-only imports.

export const PAGE_SOURCES = ["buyer_checklist", "moved_in", "calculator", "wanted", "buy_page", "buyer_guide", "empty_module"] as const;
export type PageSource = (typeof PAGE_SOURCES)[number];

export const FIRST_SOURCE_COOKIE = "nb_fs";
export const FIRST_SOURCE_MAX_AGE = 30 * 24 * 60 * 60;

const SOURCE_FORMAT = /^[a-z0-9_-]{1,60}$/;

/** A ?s= value as stored (lowercase letters, digits, dashes, underscores), or null. */
export function sourceValue(value: unknown): string | null {
  const s = String(value ?? "").trim().toLowerCase();
  return SOURCE_FORMAT.test(s) ? s : null;
}

/** The value when it's one of our page sources, otherwise null. */
export function pageSource(value: unknown): PageSource | null {
  const s = sourceValue(value);
  return s && (PAGE_SOURCES as readonly string[]).includes(s) ? (s as PageSource) : null;
}

/** An outside ?s= value worth keeping as the first source: well-formed and not one of our page sources. */
export function externalSource(value: unknown): string | null {
  const s = sourceValue(value);
  return s && !(PAGE_SOURCES as readonly string[]).includes(s) ? s : null;
}

/** Appends ?s=<source> (or &s=) to an internal path, before any #fragment. */
export function withSource(path: string, source: PageSource | null | undefined) {
  if (!source) return path;
  const [base, hash] = path.split("#", 2);
  return `${base}${base.includes("?") ? "&" : "?"}s=${source}${hash ? `#${hash}` : ""}`;
}
