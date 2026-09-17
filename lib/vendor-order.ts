// Fair vendor order for every public list of vendors. Verified vendors come first, then approved ones; inside each group
// the order rotates once a day (a hash of the Central-time date, the list's key, and the vendor id), so leads spread
// across vendors while a cached page stays consistent through the day.
//
// Nothing here reads, or may ever read, payment or plan data. No paid placement and no pay-per-lead ordering, and never
// for settlement-service categories (lenders, closing attorneys and title companies, home insurance), because of RESPA.
//
// No imports, so `node --test` can run lib/vendor-order.test.ts directly.

type Orderable = { id: string; verified_at: string | null };

/** 32-bit FNV-1a: small, fast, and stable across runtimes. Not for security. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "2026-09-17": today's date in Central time, the day the rotation changes on. */
export function rotationDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Verified first, then approved; each group in today's rotation for this list. `key` separates lists (a category, say). */
export function fairVendorOrder<T extends Orderable>(vendors: T[], key = "", day = rotationDay()): T[] {
  const rank = (v: T) => hash(`${day}|${key}|${v.id}`);
  const rotate = (group: T[]) => group.map((v) => ({ v, r: rank(v) })).sort((a, b) => a.r - b.r || a.v.id.localeCompare(b.v.id)).map(({ v }) => v);
  return [...rotate(vendors.filter((v) => v.verified_at)), ...rotate(vendors.filter((v) => !v.verified_at))];
}
