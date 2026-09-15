import type { Market } from "@/lib/markets";
import { marketZips, type MarketZipData, type ZipInfo } from "@/lib/markets/zips";

export type { ZipInfo } from "@/lib/markets/zips";

/** Just enough of a market to work with its ZIP codes. */
export type AreaMarket = Pick<Market, "slug" | "name" | "state" | "state_code">;

const EMPTY: MarketZipData = { counties: [], zips: {} };
const dataFor = (market: AreaMarket) => marketZips[market.slug] ?? EMPTY;

export function zipInfo(market: AreaMarket, zip: string): ZipInfo | undefined {
  return dataFor(market).zips[zip];
}

export function isServiceZip(market: AreaMarket, zip: string) {
  return zip in dataFor(market).zips;
}

export function cityForZip(market: AreaMarket, zip: string) {
  return zipInfo(market, zip)?.city ?? market.name;
}

/** Area label for cards: the neighborhood inside a big city, otherwise the city (or a named part of it). */
export function areaForZip(market: AreaMarket, zip: string) {
  return zipInfo(market, zip)?.area ?? cityForZip(market, zip);
}

/** "East Nashville, Nashville, TN 37206" or "Franklin, TN 37064" (no repeated city). */
export function locationLine(market: AreaMarket, zip: string, city = cityForZip(market, zip)) {
  const area = areaForZip(market, zip);
  return area === city ? `${city}, ${market.state_code} ${zip}` : `${area}, ${city}, ${market.state_code} ${zip}`;
}

export type ZipGroup = { county: string; options: { zip: string; label: string }[] };

/** ZIP options grouped by county, for select menus. */
export function zipGroups(market: AreaMarket): ZipGroup[] {
  const { counties, zips } = dataFor(market);
  return counties.map((county) => ({
    county,
    options: Object.entries(zips)
      .filter(([, info]) => info.county === county)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zip, info]) => ({ zip, label: info.area === info.city ? `${zip} · ${info.city}` : `${zip} · ${info.area}, ${info.city}` })),
  }));
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bmount\b/g, "mt")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bst\.?\b/g, "st")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(["and", "the", "county", "area", "near"]);

/** Turns a free-text "ZIP, city, neighborhood, or county" search into matching ZIP codes in this market. */
export function zipsForSearch(market: AreaMarket, query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  const zip = q.match(/\b\d{5}\b/)?.[0];
  if (zip) return isServiceZip(market, zip) ? [zip] : [];
  const stop = new Set([...STOP, market.state_code.toLowerCase(), ...normalize(market.state).split(" ")]);
  const words = q.split(" ").filter((w) => w.length > 1 && !stop.has(w));
  if (words.length === 0) return [];
  return Object.entries(dataFor(market).zips)
    .filter(([, info]) => {
      const haystack = normalize(`${info.area} ${info.city} ${info.county} county`);
      return words.every((w) => haystack.includes(w));
    })
    .map(([code]) => code);
}
