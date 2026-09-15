// Residential ZIP codes Nashville Buys serves across Middle Tennessee: Davidson, Williamson, Rutherford, Sumner,
// and Wilson counties. Each has the mailing city and a common area name. Area names are approximate (ZIP lines
// don't follow neighborhood lines), and a few ZIPs cross county lines; `county` is the primary one.
// PO-box-only and single-business ZIPs are left out.

export type County = "Davidson" | "Williamson" | "Rutherford" | "Sumner" | "Wilson";
export type ZipInfo = { city: string; area: string; county: County };

const z = (city: string, county: County, area = city): ZipInfo => ({ city, area, county });

export const serviceZips: Record<string, ZipInfo> = {
  // Davidson County
  "37013": z("Antioch", "Davidson"),
  "37072": z("Goodlettsville", "Davidson"),
  "37076": z("Hermitage", "Davidson"),
  "37080": z("Joelton", "Davidson"),
  "37115": z("Madison", "Davidson"),
  "37138": z("Old Hickory", "Davidson"),
  "37189": z("Whites Creek", "Davidson"),
  "37201": z("Nashville", "Davidson", "Downtown"),
  "37203": z("Nashville", "Davidson", "Midtown and The Gulch"),
  "37204": z("Nashville", "Davidson", "Melrose, 12South, and Berry Hill"),
  "37205": z("Nashville", "Davidson", "Belle Meade and West Meade"),
  "37206": z("Nashville", "Davidson", "East Nashville"),
  "37207": z("Nashville", "Davidson", "North East Nashville"),
  "37208": z("Nashville", "Davidson", "Germantown and North Nashville"),
  "37209": z("Nashville", "Davidson", "The Nations and Sylvan Park"),
  "37210": z("Nashville", "Davidson", "Wedgewood-Houston"),
  "37211": z("Nashville", "Davidson", "Crieve Hall and South Nashville"),
  "37212": z("Nashville", "Davidson", "Belmont and Hillsboro Village"),
  "37213": z("Nashville", "Davidson", "East Bank"),
  "37214": z("Nashville", "Davidson", "Donelson"),
  "37215": z("Nashville", "Davidson", "Green Hills"),
  "37216": z("Nashville", "Davidson", "Inglewood"),
  "37217": z("Nashville", "Davidson", "Priest Lake and Airport"),
  "37218": z("Nashville", "Davidson", "Bordeaux"),
  "37219": z("Nashville", "Davidson", "Downtown"),
  "37220": z("Nashville", "Davidson", "Oak Hill"),
  "37221": z("Nashville", "Davidson", "Bellevue"),
  "37228": z("Nashville", "Davidson", "MetroCenter"),

  // Williamson County
  "37014": z("Arrington", "Williamson"),
  "37027": z("Brentwood", "Williamson"),
  "37046": z("College Grove", "Williamson"),
  "37062": z("Fairview", "Williamson"),
  "37064": z("Franklin", "Williamson"),
  "37067": z("Franklin", "Williamson", "Cool Springs"),
  "37069": z("Franklin", "Williamson"),
  "37135": z("Nolensville", "Williamson"),
  "37174": z("Spring Hill", "Williamson"),
  "37179": z("Thompson's Station", "Williamson"),

  // Rutherford County
  "37037": z("Christiana", "Rutherford"),
  "37060": z("Eagleville", "Rutherford"),
  "37085": z("Lascassas", "Rutherford"),
  "37086": z("La Vergne", "Rutherford"),
  "37118": z("Milton", "Rutherford"),
  "37127": z("Murfreesboro", "Rutherford"),
  "37128": z("Murfreesboro", "Rutherford"),
  "37129": z("Murfreesboro", "Rutherford"),
  "37130": z("Murfreesboro", "Rutherford"),
  "37149": z("Readyville", "Rutherford"),
  "37153": z("Rockvale", "Rutherford"),
  "37167": z("Smyrna", "Rutherford"),

  // Sumner County
  "37022": z("Bethpage", "Sumner"),
  "37031": z("Castalian Springs", "Sumner"),
  "37048": z("Cottontown", "Sumner"),
  "37066": z("Gallatin", "Sumner"),
  "37075": z("Hendersonville", "Sumner"),
  "37148": z("Portland", "Sumner"),
  "37186": z("Westmoreland", "Sumner"),
  "37188": z("White House", "Sumner"),

  // Wilson County
  "37087": z("Lebanon", "Wilson"),
  "37090": z("Lebanon", "Wilson"),
  "37122": z("Mt. Juliet", "Wilson"),
  "37184": z("Watertown", "Wilson"),
};

export const COUNTIES: County[] = ["Davidson", "Williamson", "Rutherford", "Sumner", "Wilson"];

export function zipInfo(zip: string): ZipInfo | undefined {
  return serviceZips[zip];
}

export function isServiceZip(zip: string) {
  return zip in serviceZips;
}

export function cityForZip(zip: string) {
  return serviceZips[zip]?.city ?? "Nashville";
}

/** Area label for cards: the neighborhood inside Nashville, otherwise the city (or a named part of it). */
export function areaForZip(zip: string) {
  return serviceZips[zip]?.area ?? cityForZip(zip);
}

/** "East Nashville, Nashville, TN 37206" or "Franklin, TN 37064" (no repeated city). */
export function locationLine(zip: string, city = cityForZip(zip)) {
  const area = areaForZip(zip);
  return area === city ? `${city}, TN ${zip}` : `${area}, ${city}, TN ${zip}`;
}

/** ZIP options grouped by county, for select menus. */
export const zipGroups = COUNTIES.map((county) => ({
  county,
  options: Object.entries(serviceZips)
    .filter(([, info]) => info.county === county)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zip, info]) => ({ zip, label: info.area === info.city ? `${zip} · ${info.city}` : `${zip} · ${info.area}, ${info.city}` })),
}));

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bmount\b/g, "mt")
    .replace(/\bst\.?\b/g, "st")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(["and", "the", "tn", "tennessee", "county", "area", "near"]);

/** Turns a free-text "ZIP, city, neighborhood, or county" search into matching ZIP codes. */
export function zipsForSearch(query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  const zip = q.match(/\b\d{5}\b/)?.[0];
  if (zip) return isServiceZip(zip) ? [zip] : [];
  const words = q.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  if (words.length === 0) return [];
  return Object.entries(serviceZips)
    .filter(([, info]) => {
      const haystack = normalize(`${info.area} ${info.city} ${info.county} county`);
      return words.every((w) => haystack.includes(w));
    })
    .map(([code]) => code);
}
