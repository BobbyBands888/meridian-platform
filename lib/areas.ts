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

/** One named area in a market's ZIP map: a neighborhood inside a big city, or a town. */
export type Area = {
  slug: string;
  name: string;
  /** The county with the most of this area's ZIP codes; a few areas straddle a line. */
  county: string;
  city: string;
  zips: string[];
};

export const areaSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const areaCache = new Map<string, Area[]>();

/** Every area in a market's ZIP map, in alphabetical order. */
export function marketAreas(market: AreaMarket): Area[] {
  const cached = areaCache.get(market.slug);
  if (cached) return cached;

  const grouped = new Map<string, { name: string; zips: string[]; counties: string[]; cities: string[] }>();
  for (const [zip, info] of Object.entries(dataFor(market).zips)) {
    const entry = grouped.get(info.area) ?? { name: info.area, zips: [], counties: [], cities: [] };
    entry.zips.push(zip);
    entry.counties.push(info.county);
    entry.cities.push(info.city);
    grouped.set(info.area, entry);
  }

  const commonest = (values: string[]) =>
    [...new Set(values)].sort((a, b) => values.filter((v) => v === b).length - values.filter((v) => v === a).length)[0];

  const areas = [...grouped.values()]
    .map((entry): Area => ({
      slug: areaSlug(entry.name),
      name: entry.name,
      county: commonest(entry.counties),
      city: commonest(entry.cities),
      zips: entry.zips.sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  areaCache.set(market.slug, areas);
  return areas;
}

export function areaBySlug(market: AreaMarket, slug: string): Area | undefined {
  return marketAreas(market).find((a) => a.slug === slug);
}

/** Areas grouped by county, in the market's county order, for the "All areas" page. */
export function areasByCounty(market: AreaMarket): { county: string; areas: Area[] }[] {
  const areas = marketAreas(market);
  return dataFor(market)
    .counties.map((county) => ({ county, areas: areas.filter((a) => a.county === county) }))
    .filter((group) => group.areas.length > 0);
}

/** "ZIP 37206" or "ZIPs 37206, 37207, and 37216" */
export function zipPhrase(zips: string[]) {
  if (zips.length === 1) return `ZIP ${zips[0]}`;
  return `ZIPs ${zips.slice(0, -1).join(", ")}${zips.length > 2 ? "," : ""} and ${zips.at(-1)}`;
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
