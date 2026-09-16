import type { MarketZipData, ZipInfo } from "./types";

// Residential ZIP codes Nashville Buys serves across Greater Nashville & Middle Tennessee: Davidson, Williamson,
// Rutherford, Sumner, Wilson, Maury, Montgomery, Robertson, Cheatham, and Dickson counties. Each has the mailing city
// and a common area name. Area names are approximate (ZIP lines don't follow neighborhood lines), and a few ZIPs cross
// county lines; `county` is the primary one among the counties we cover. PO-box-only and single-business ZIPs are
// left out.
//
// Maury, Montgomery, Robertson, Cheatham, and Dickson (added 2026-09-16) come from the US Census Bureau 2020 ZCTA to
// County Relationship File (tab20_zcta520_county20_natl.txt, www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/,
// downloaded 2026-09-16). A ZIP is included when at least 10% of its land area is in one of those counties. Mailing
// city names are from the GeoNames US postal code file (download.geonames.org/export/zip/, same date).
// Left out: 42223 Fort Campbell (Army post housing, Kentucky mailing address), and ZIPs with under 2% of their land in
// a new county: 37061 Erin, 37091 Lewisburg, 38483 Summertown.
// Census land shares moved two existing ZIPs: 37174 Spring Hill is 75% Maury (25% Williamson), and 37188 White House
// is 73% Robertson (27% Sumner). 37146 Pleasant View is 54% Robertson by land but the town is in Cheatham County.

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

  // Wilson County
  "37087": z("Lebanon", "Wilson"),
  "37090": z("Lebanon", "Wilson"),
  "37122": z("Mt. Juliet", "Wilson"),
  "37184": z("Watertown", "Wilson"),

  // Maury County
  "37174": z("Spring Hill", "Maury"), // 25% Williamson
  "38401": z("Columbia", "Maury"),
  "38451": z("Culleoka", "Maury"),
  "38461": z("Hampshire", "Maury"), // 42% Maury, mostly Lewis
  "38474": z("Mount Pleasant", "Maury"),
  "38476": z("Primm Springs", "Maury"), // 17% Maury, mostly Hickman
  "38482": z("Santa Fe", "Maury"),
  "38487": z("Williamsport", "Maury"),

  // Montgomery County
  "37040": z("Clarksville", "Montgomery"),
  "37042": z("Clarksville", "Montgomery"),
  "37043": z("Clarksville", "Montgomery"),
  "37050": z("Cumberland City", "Montgomery"), // 22% Montgomery, mostly Stewart
  "37052": z("Cunningham", "Montgomery"),
  "37079": z("Indian Mound", "Montgomery"), // 20% Montgomery, mostly Stewart
  "37142": z("Palmyra", "Montgomery"),
  "37171": z("Southside", "Montgomery"),
  "37191": z("Woodlawn", "Montgomery"),

  // Robertson County
  "37010": z("Adams", "Robertson"), // 39% Montgomery
  "37032": z("Cedar Hill", "Robertson"),
  "37049": z("Cross Plains", "Robertson"),
  "37073": z("Greenbrier", "Robertson"),
  "37141": z("Orlinda", "Robertson"),
  "37172": z("Springfield", "Robertson"),
  "37188": z("White House", "Robertson"), // 27% Sumner

  // Cheatham County
  "37015": z("Ashland City", "Cheatham"),
  "37035": z("Chapmansboro", "Cheatham"),
  "37082": z("Kingston Springs", "Cheatham"),
  "37143": z("Pegram", "Cheatham"),
  "37146": z("Pleasant View", "Cheatham"), // 54% Robertson

  // Dickson County
  "37025": z("Bon Aqua", "Dickson"), // 24% Dickson, mostly Hickman
  "37029": z("Burns", "Dickson"),
  "37036": z("Charlotte", "Dickson"),
  "37051": z("Cumberland Furnace", "Dickson"), // 24% Montgomery
  "37055": z("Dickson", "Dickson"),
  "37165": z("Slayden", "Dickson"),
  "37181": z("Vanleer", "Dickson"),
  "37187": z("White Bluff", "Dickson"), // 22% Cheatham
};

export const nashville: MarketZipData = {
  counties: ["Davidson", "Williamson", "Rutherford", "Sumner", "Wilson", "Maury", "Montgomery", "Robertson", "Cheatham", "Dickson"],
  zips,
};
