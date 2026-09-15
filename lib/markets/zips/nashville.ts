import type { MarketZipData, ZipInfo } from "./types";

// Residential ZIP codes Nashville Buys serves across Middle Tennessee: Davidson, Williamson, Rutherford, Sumner,
// and Wilson counties. Each has the mailing city and a common area name. Area names are approximate (ZIP lines
// don't follow neighborhood lines), and a few ZIPs cross county lines; `county` is the primary one.
// PO-box-only and single-business ZIPs are left out.

const z = (city: string, county: string, area = city): ZipInfo => ({ city, area, county });

const zips: Record<string, ZipInfo> = {
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

export const nashville: MarketZipData = {
  counties: ["Davidson", "Williamson", "Rutherford", "Sumner", "Wilson"],
  zips,
};
