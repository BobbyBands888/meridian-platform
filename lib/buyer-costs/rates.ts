// Every rate and fee the buyer cost calculator uses, each with its source and the date it was checked.
// Figures come from official state, federal, county, and city sources. Rates that aren't confirmed in an official source
// yet are marked "estimate": the page labels them "estimate, confirm on your trustee's bill" and lets the buyer edit them.
// Cities with no figure at all are left out.
//
// Update CHECKED_ON and each row's taxYear/asOf when re-verifying. Type-only imports, so `node --test` can load this file.

import type { LoanRules } from "./calc";

/** The day these figures were last checked against their sources. Shown on the page as "Rates as of". */
export const CHECKED_ON = "2026-09-17";

export type Sourced = { sourceLabel: string; sourceUrl: string; asOf: string };

// ---------------------------------------------------------------------------------------------------------------------
// Loan and closing rules
// ---------------------------------------------------------------------------------------------------------------------

export const LOAN_RULES: LoanRules = {
  assessmentRatio: 0.25,
  transferTaxPer100: 0.37,
  mortgageTaxPer100: 0.115,
  mortgageTaxExempt: 2000,
  conventional: { pmiAnnualRate: 0.006, pmiMaxLtv: 0.8, minDown: 0.03 },
  fha: {
    upfrontRate: 0.0175,
    minDown: 0.035,
    highBalanceThreshold: 726_200,
    annualLongTerm: {
      standard: [
        { maxLtv: 0.9, rate: 0.005 },
        { maxLtv: 0.95, rate: 0.005 },
        { maxLtv: Infinity, rate: 0.0055 },
      ],
      highBalance: [
        { maxLtv: 0.9, rate: 0.007 },
        { maxLtv: 0.95, rate: 0.007 },
        { maxLtv: Infinity, rate: 0.0075 },
      ],
    },
    annualShortTerm: {
      standard: [
        { maxLtv: 0.9, rate: 0.0015 },
        { maxLtv: Infinity, rate: 0.004 },
      ],
      highBalance: [
        { maxLtv: 0.78, rate: 0.0015 },
        { maxLtv: 0.9, rate: 0.004 },
        { maxLtv: Infinity, rate: 0.0065 },
      ],
    },
  },
  va: {
    firstUse: [
      { minDown: 0.1, rate: 0.0125 },
      { minDown: 0.05, rate: 0.015 },
      { minDown: 0, rate: 0.0215 },
    ],
    subsequentUse: [
      { minDown: 0.1, rate: 0.0125 },
      { minDown: 0.05, rate: 0.015 },
      { minDown: 0, rate: 0.033 },
    ],
  },
  closingCostRange: [0.02, 0.05],
};

/** Page defaults. The rate and insurance are examples the buyer should replace with their own quotes. */
export const EXAMPLE_DEFAULTS = {
  price: 450_000,
  downPercent: 10,
  ratePercent: 6.5,
  termYears: 30 as const,
  insuranceYearly: 1_649,
};

/** Sources for the loan and closing figures, in the order the page lists them. */
export const LOAN_SOURCES: (Sourced & { figure: string })[] = [
  {
    figure: "Residential property assessed at 25% of appraised value",
    sourceLabel: "Tennessee Comptroller, How to Figure Your Tax Bill (T.C.A. § 67-5-801)",
    sourceUrl: "https://comptroller.tn.gov/office-functions/pa/property-taxes/how-to-figure-your-tax-bill.html",
    asOf: CHECKED_ON,
  },
  {
    figure: "Transfer tax $0.37 per $100; mortgage tax $0.115 per $100 of principal over $2,000",
    sourceLabel: "Tennessee Department of Revenue, Recordation Tax rates and June 2026 tax manual (T.C.A. § 67-4-409)",
    sourceUrl: "https://www.tn.gov/revenue/taxes/local-taxes/recordation-taxes/due-date-tax-rate.html",
    asOf: "2026-06",
  },
  {
    figure: "Who pays the transfer and mortgage taxes",
    sourceLabel: "Tennessee Department of Revenue, Recordation Tax manual (June 2026)",
    sourceUrl: "https://www.tn.gov/content/dam/tn/revenue/documents/tax_manuals/june-2026/recordation-tax.pdf",
    asOf: "2026-06",
  },
  {
    figure: "PMI assumption: 0.60% of the loan a year below 20% down (midpoint of $30–$70 a month per $100,000)",
    sourceLabel: "Freddie Mac, Breaking Down PMI",
    sourceUrl: "https://myhome.freddiemac.com/buying/breaking-down-pmi",
    asOf: CHECKED_ON,
  },
  {
    figure: "PMI cancellation at 80% and automatic end at 78% of original value",
    sourceLabel: "CFPB, When can I remove PMI?",
    sourceUrl: "https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/",
    asOf: "2026-08-28",
  },
  {
    figure: "FHA upfront premium 1.75%; annual premium 0.15%–0.75% by term, loan size, and down payment",
    sourceLabel: "HUD Mortgagee Letter 2023-05",
    sourceUrl: "https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf",
    asOf: "2023-03-20",
  },
  {
    figure: "VA funding fee 2.15%/1.5%/1.25% first use, 3.3%/1.5%/1.25% later use; exemptions; no monthly mortgage insurance",
    sourceLabel: "VA.gov, VA funding fee and loan closing costs",
    sourceUrl: "https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/",
    asOf: CHECKED_ON,
  },
  {
    figure: "Closing costs typically 2%–5% of the purchase price, not counting the down payment",
    sourceLabel: "CFPB, Determine your down payment",
    sourceUrl: "https://www.consumerfinance.gov/owning-a-home/prepare/determine-your-down-payment/",
    asOf: "2025-10-01",
  },
  {
    figure: "Example insurance: $1,649 a year, the average Tennessee HO-3 premium (2023 data)",
    sourceLabel: "NAIC, Dwelling Fire, Homeowners Owner-Occupied, and Homeowners Tenant and Condo/Coop Insurance Report",
    sourceUrl: "https://content.naic.org/sites/default/files/publication-hmr-zu-homeowners-report.pdf",
    asOf: "2026-07",
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// Property tax rates (per $100 of assessed value)
// ---------------------------------------------------------------------------------------------------------------------

export type RateStatus = "official" | "estimate";

export type RateSource = { label: string; url: string };

/** One place a home can be taxed: its combined rate and the parts that add up to it. */
export type TaxArea = {
  id: string;
  label: string;
  parts: { label: string; rate: number }[];
  /** "estimate" when any part isn't confirmed in an official, adopted source for the tax year. */
  status: RateStatus;
  /** Tax year the rates are for (the oldest part's year, when parts differ). */
  taxYear: number;
  sources: RateSource[];
};

export type CountyTax = {
  county: string;
  /** Places outside any city's limits (usually one; more where a district changes the rate). */
  outside: TaxArea[];
  /** Cities with a rate we could source. Cities with no figure are left out. */
  cities: TaxArea[];
  note?: string;
};

export const combinedRate = (area: Pick<TaxArea, "parts">) => Math.round(area.parts.reduce((sum, p) => sum + p.rate, 0) * 10_000) / 10_000;

const COMPTROLLER_2025: RateSource = {
  label: "Tennessee Comptroller, 2025 property tax rates",
  url: "https://comptroller.tn.gov/office-functions/pa/tax-resources/assessment-information-for-each-county/property-tax-rates/2025.html",
};

// Davidson ------------------------------------------------------------------------------------------------------------
const METRO_ORDINANCE: RateSource = {
  label: "Metro Nashville tax levy ordinance BL2026-1378",
  url: "https://nashville.legistar.com/LegislationDetail.aspx?ID=8001307&GUID=971EBF64-08CD-4D9F-AF23-0C6B60634EB1",
};
const METRO_TRUSTEE: RateSource = { label: "Metro Nashville Trustee", url: "https://www.nashville.gov/departments/trustee/calculate-property-taxes" };
const GSD = { label: "Metro GSD", rate: 2.782 };

// Williamson ----------------------------------------------------------------------------------------------------------
const WILLIAMSON_TRUSTEE: RateSource = { label: "Williamson County Trustee, 2026 property tax rates", url: "https://www.williamsoncounty-tn.gov/2211/2026-Property-Tax-Rates" };
const williamson = (id: string, label: string, parts: TaxArea["parts"]): TaxArea => ({ id, label, parts, status: "official", taxYear: 2026, sources: [WILLIAMSON_TRUSTEE] });

// Rutherford ----------------------------------------------------------------------------------------------------------
const RUTHERFORD_COUNTY = { label: "Rutherford County", rate: 1.4885 };
const RUTHERFORD_RELEASE: RateSource = {
  label: "Rutherford County, 2026 tax rate release",
  url: "https://rutherfordcountytn.gov/index.asp?DE=9E55DABD-BC79-4E81-9034-7AF7D59E85E0&SEC=19F331FD-79E1-48F0-A344-4BE43713B14D",
};

// Sumner --------------------------------------------------------------------------------------------------------------
const SUMNER_COUNTY = { label: "Sumner County", rate: 1.421 };
const SUMNER_BUDGET: RateSource = { label: "Sumner County FY2027 budget", url: "https://sumnercountytn.gov/wp-content/uploads/2026/07/FY2027-Budget.pdf" };

// Wilson --------------------------------------------------------------------------------------------------------------
const WILSON_COUNTY = { label: "Wilson County", rate: 1.1657 };
const MT_JULIET: RateSource = { label: "City of Mt. Juliet, property tax", url: "https://www.mtjuliet-tn.gov/160/Property-Tax" };
const LEBANON_ESTIMATES: RateSource = {
  label: "Lebanon Democrat, estimated 2026 rates (May 8, 2026)",
  url: "https://www.lebanondemocrat.com/lebanon/wilson-county-property-values-rise-66-tax-rate-to-drop-keeping-county-budget-neutral/article_5c26aad0-0ddc-5f2f-8168-ff93d581c9b4.html",
};

// Maury ---------------------------------------------------------------------------------------------------------------
const MAURY_COUNTY = { label: "Maury County", rate: 1.369 };
const MAURY_NEWS: RateSource = {
  label: "Main Street Maury, FY2026-27 county budget",
  url: "https://mainstreetmediatn.com/articles/mainstreetmaury/closer-look-at-maury-countys-approved-fy-2026-27-budget/",
};

// Montgomery ----------------------------------------------------------------------------------------------------------
const MONTGOMERY_ASSESSOR: RateSource = { label: "Montgomery County Assessor, 2026 tax rates", url: "https://montgomerytn.gov/assessor/property-tax-and-proration-calculators" };

// Robertson -----------------------------------------------------------------------------------------------------------
const ROBERTSON_COUNTY = { label: "Robertson County", rate: 1.8 };
const ROBERTSON_BUDGET: RateSource = { label: "Robertson County FY2027 budget", url: "https://robertsoncountytn.gov/departments/finance/Annual%20Budget%20Documents/FY%202027%20Budget.pdf" };
const WHITE_HOUSE: RateSource = { label: "City of White House Ordinance 26-05", url: "https://www.whitehousetn.gov/DocumentCenter/View/1494" };
const RIDGETOP: RateSource = { label: "City of Ridgetop Ordinance 2026-103", url: "https://ridgetoptn.org/assets/pdfs/ordinances/2026/103.pdf" };
const GOODLETTSVILLE: RateSource = {
  label: "City of Goodlettsville Ordinance 26-1145 (June 11, 2026 council packet)",
  url: "https://goodlettsvilletn.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId=4050,plainText=false)",
};

// Cheatham ------------------------------------------------------------------------------------------------------------
const CHEATHAM_COUNTY = { label: "Cheatham County", rate: 1.753 };
const CHEATHAM_MINUTES: RateSource = { label: "Cheatham County Commission minutes, June 29, 2026 (tax levy)", url: "https://www.cheathamcountytn.gov/uploads/June%202026%20minutes.pdf" };

// Dickson -------------------------------------------------------------------------------------------------------------
const DICKSON_COUNTY = { label: "Dickson County (2025 rate)", rate: 1.69 };

const area = (id: string, label: string, parts: TaxArea["parts"], status: RateStatus, taxYear: number, sources: RateSource[]): TaxArea => ({
  id,
  label,
  parts,
  status,
  taxYear,
  sources,
});

export const COUNTY_TAX: CountyTax[] = [
  {
    county: "Davidson",
    outside: [area("davidson-gsd", "General Services District (outside the Urban Services District)", [GSD], "official", 2026, [METRO_ORDINANCE, METRO_TRUSTEE])],
    cities: [
      area("nashville-usd", "Nashville, Urban Services District", [GSD, { label: "USD", rate: 0.032 }], "official", 2026, [METRO_ORDINANCE, METRO_TRUSTEE]),
      area("belle-meade", "Belle Meade", [GSD, { label: "Belle Meade", rate: 0.3011 }], "official", 2026, [
        METRO_ORDINANCE,
        { label: "City of Belle Meade Ordinance 2026-6", url: "https://citybellemeade.org/wp-content/uploads/2026/07/ORD-2026-6-Fix-Tax-Rate-For-For-Belle-Meade-For-Fiscal-Year-July-1-2026-June-30-2027.pdf" },
      ]),
      area("berry-hill", "Berry Hill (no city property tax)", [GSD], "estimate", 2026, [
        METRO_ORDINANCE,
        { label: "City of Berry Hill FY2026-27 budget (no property tax line)", url: "https://www.berryhilltn.gov/Archive.aspx?ADID=1725" },
      ]),
      area("forest-hills", "Forest Hills (no city property tax)", [GSD], "official", 2026, [
        METRO_ORDINANCE,
        { label: "City of Forest Hills, finance", url: "https://www.cityofforesthills.com/page/finance" },
      ]),
      area("goodlettsville-davidson", "Goodlettsville", [GSD, { label: "Goodlettsville", rate: 0.5068 }], "official", 2026, [METRO_ORDINANCE, GOODLETTSVILLE]),
      area("oak-hill", "Oak Hill (no city property tax)", [GSD], "official", 2026, [
        METRO_ORDINANCE,
        { label: "City of Oak Hill, property tax", url: "https://www.oakhilltn.us/community/page/davidson-county-property-tax-rates-calculator" },
      ]),
      area("ridgetop-davidson", "Ridgetop", [GSD, { label: "Ridgetop", rate: 0.349 }], "official", 2026, [METRO_ORDINANCE, RIDGETOP]),
    ],
  },
  {
    county: "Williamson",
    outside: [
      williamson("williamson-county", "Outside city limits", [{ label: "Williamson County", rate: 1.3 }]),
      williamson("williamson-fssd", "Outside city limits, in Franklin Special School District", [
        { label: "Williamson County", rate: 1.21 },
        { label: "Franklin SSD", rate: 0.7673 },
      ]),
    ],
    cities: [
      williamson("brentwood", "Brentwood", [{ label: "Williamson County", rate: 1.3 }, { label: "Brentwood", rate: 0.19 }]),
      williamson("fairview", "Fairview", [{ label: "Williamson County", rate: 1.3 }, { label: "Fairview", rate: 0.8404 }]),
      williamson("franklin-fssd", "Franklin, in Franklin Special School District", [
        { label: "Williamson County", rate: 1.18 },
        { label: "Franklin SSD", rate: 0.7673 },
        { label: "Franklin", rate: 0.296 },
      ]),
      williamson("franklin", "Franklin, not in Franklin Special School District", [{ label: "Williamson County", rate: 1.27 }, { label: "Franklin", rate: 0.296 }]),
      williamson("nolensville", "Nolensville", [{ label: "Williamson County", rate: 1.3 }, { label: "Nolensville", rate: 0.34 }]),
      williamson("spring-hill-williamson", "Spring Hill", [{ label: "Williamson County", rate: 1.27 }, { label: "Spring Hill", rate: 0.739 }]),
      williamson("thompsons-station", "Thompson's Station", [{ label: "Williamson County", rate: 1.3 }, { label: "Thompson's Station", rate: 0.103 }]),
    ],
    note: "Franklin Special School District covers part of Franklin and some nearby areas. Check your address with the Williamson County Trustee.",
  },
  {
    county: "Rutherford",
    outside: [area("rutherford-county", "Outside city limits", [RUTHERFORD_COUNTY], "official", 2026, [RUTHERFORD_RELEASE])],
    cities: [
      area("eagleville", "Eagleville", [RUTHERFORD_COUNTY, { label: "Eagleville", rate: 0.3093 }], "estimate", 2026, [
        RUTHERFORD_RELEASE,
        { label: "Town of Eagleville tax rate ordinance (council agenda, adoption not confirmed)", url: "https://www.eaglevilletn.gov/uploads/city_council_agendas_minutes_37_2695478792.pdf" },
      ]),
      area("la-vergne", "La Vergne", [RUTHERFORD_COUNTY, { label: "La Vergne", rate: 0.4359 }], "official", 2026, [
        RUTHERFORD_RELEASE,
        { label: "City of La Vergne FY2026-27 approved budget", url: "https://www.lavergnetn.gov/DocumentCenter/View/4654" },
      ]),
      area("murfreesboro", "Murfreesboro", [RUTHERFORD_COUNTY, { label: "Murfreesboro", rate: 0.7529 }], "official", 2026, [
        RUTHERFORD_RELEASE,
        { label: "City of Murfreesboro Ordinance 26-O-22", url: "https://www.murfreesborotn.gov/Archive/ViewFile/Item/4439" },
      ]),
      area("smyrna", "Smyrna", [RUTHERFORD_COUNTY, { label: "Smyrna", rate: 0.4258 }], "estimate", 2026, [
        RUTHERFORD_RELEASE,
        { label: "WGNS, certified tax rates after the Rutherford County reappraisal", url: "https://www.wgnsradio.com/article/99918/new-certified-tax-rates-announced-after-rutherford-county-reappraisal" },
      ]),
    ],
  },
  {
    county: "Sumner",
    outside: [area("sumner-county", "Outside city limits", [SUMNER_COUNTY], "official", 2026, [SUMNER_BUDGET])],
    cities: [
      area("gallatin", "Gallatin", [SUMNER_COUNTY, { label: "Gallatin", rate: 0.5295 }], "estimate", 2026, [
        SUMNER_BUDGET,
        { label: "City of Gallatin tax rate ordinance O2605-41 (proposed)", url: "https://www.gallatintn.gov/AgendaCenter/ViewFile/Agenda/_05122026-955" },
      ]),
      area("goodlettsville-sumner", "Goodlettsville", [SUMNER_COUNTY, { label: "Goodlettsville", rate: 0.5068 }], "official", 2026, [SUMNER_BUDGET, GOODLETTSVILLE]),
      area("hendersonville", "Hendersonville", [SUMNER_COUNTY, { label: "Hendersonville", rate: 0.5883 }], "official", 2026, [
        SUMNER_BUDGET,
        { label: "City of Hendersonville Ordinance 2026-07", url: "https://www.hvilletn.org/AgendaCenter/ViewFile/Agenda/_06092026-593" },
      ]),
      area("millersville", "Millersville", [SUMNER_COUNTY, { label: "Millersville (2025 rate)", rate: 0.6698 }], "estimate", 2025, [SUMNER_BUDGET, COMPTROLLER_2025]),
      area("portland", "Portland", [SUMNER_COUNTY, { label: "Portland (2025 rate)", rate: 0.9 }], "estimate", 2025, [SUMNER_BUDGET, COMPTROLLER_2025]),
      area("westmoreland", "Westmoreland", [SUMNER_COUNTY, { label: "Westmoreland (2025 rate)", rate: 0.83 }], "estimate", 2025, [SUMNER_BUDGET, COMPTROLLER_2025]),
      area("white-house-sumner", "White House", [SUMNER_COUNTY, { label: "White House", rate: 0.8961 }], "official", 2026, [SUMNER_BUDGET, WHITE_HOUSE]),
    ],
  },
  {
    county: "Wilson",
    outside: [area("wilson-county", "Outside city limits", [WILSON_COUNTY], "official", 2026, [MT_JULIET])],
    cities: [
      area("lebanon", "Lebanon, in Lebanon Special School District", [WILSON_COUNTY, { label: "Lebanon", rate: 0.405 }, { label: "Lebanon SSD", rate: 0.1786 }], "estimate", 2026, [
        MT_JULIET,
        LEBANON_ESTIMATES,
      ]),
      area("mt-juliet", "Mt. Juliet", [WILSON_COUNTY, { label: "Mt. Juliet", rate: 0.28 }], "official", 2026, [MT_JULIET]),
      area("watertown", "Watertown", [WILSON_COUNTY, { label: "Watertown", rate: 0.3435 }], "estimate", 2026, [MT_JULIET, LEBANON_ESTIMATES]),
    ],
    note: "Wilson County reappraised in 2026, and city rates for Lebanon and Watertown were still estimates when we checked. The Lebanon Special School District doesn't cover every Lebanon address.",
  },
  {
    county: "Maury",
    outside: [area("maury-county", "Outside city limits", [MAURY_COUNTY], "estimate", 2026, [MAURY_NEWS])],
    cities: [
      area("spring-hill-maury", "Spring Hill", [MAURY_COUNTY, { label: "Spring Hill", rate: 0.739 }], "estimate", 2026, [MAURY_NEWS, WILLIAMSON_TRUSTEE]),
    ],
    note: "Maury County reappraised in 2026. We couldn't confirm 2026 rates for Columbia or Mount Pleasant, so they aren't listed; enter the rate from your tax bill.",
  },
  {
    county: "Montgomery",
    outside: [area("montgomery-county", "Outside city limits", [{ label: "Montgomery County", rate: 2.1 }], "official", 2026, [MONTGOMERY_ASSESSOR])],
    cities: [
      area("clarksville", "Clarksville", [{ label: "Montgomery County", rate: 2.1 }, { label: "Clarksville", rate: 1.01 }], "official", 2026, [
        MONTGOMERY_ASSESSOR,
        { label: "City of Clarksville, FY2027 property tax rate", url: "https://www.clarksvilletn.gov/m/newsflash/home/detail/4101" },
      ]),
    ],
  },
  {
    county: "Robertson",
    outside: [area("robertson-county", "Outside city limits", [ROBERTSON_COUNTY], "official", 2026, [ROBERTSON_BUDGET])],
    cities: [
      area("adams", "Adams", [ROBERTSON_COUNTY, { label: "Adams (2025 rate)", rate: 0.3 }], "estimate", 2025, [ROBERTSON_BUDGET, COMPTROLLER_2025]),
      area("cedar-hill", "Cedar Hill", [ROBERTSON_COUNTY, { label: "Cedar Hill (2025 rate)", rate: 0.1301 }], "estimate", 2025, [ROBERTSON_BUDGET, COMPTROLLER_2025]),
      area("coopertown", "Coopertown", [ROBERTSON_COUNTY, { label: "Coopertown", rate: 0.35 }], "official", 2026, [
        ROBERTSON_BUDGET,
        { label: "Town of Coopertown Ordinance 2026-007", url: "https://irp.cdn-website.com/2e4b432f/files/uploaded/Ordinance+2026-007+Adopt+Annual+Budget+Fy+2026-2027-+Signed.pdf" },
      ]),
      area("greenbrier", "Greenbrier", [ROBERTSON_COUNTY, { label: "Greenbrier", rate: 1.3 }], "official", 2026, [
        ROBERTSON_BUDGET,
        { label: "Town of Greenbrier Ordinance 26-05", url: "https://greenbriertn.org/AgendaCenter/ViewFile/Agenda/_06012026-324" },
      ]),
      area("ridgetop-robertson", "Ridgetop", [ROBERTSON_COUNTY, { label: "Ridgetop", rate: 0.3786 }], "official", 2026, [ROBERTSON_BUDGET, RIDGETOP]),
      area("springfield", "Springfield", [ROBERTSON_COUNTY, { label: "Springfield (2025 rate)", rate: 0.7953 }], "estimate", 2025, [ROBERTSON_BUDGET, COMPTROLLER_2025]),
      area("white-house-robertson", "White House", [ROBERTSON_COUNTY, { label: "White House", rate: 0.8961 }], "official", 2026, [ROBERTSON_BUDGET, WHITE_HOUSE]),
    ],
  },
  {
    county: "Cheatham",
    outside: [
      area("cheatham-fire", "Outside city limits, Cheatham County Fire District", [CHEATHAM_COUNTY, { label: "Cheatham County Fire District", rate: 0.1753 }], "official", 2026, [CHEATHAM_MINUTES]),
      area("cheatham-harpeth-ridge", "Outside city limits, Harpeth Ridge Fire District", [CHEATHAM_COUNTY, { label: "Harpeth Ridge Fire District", rate: 0.0581 }], "official", 2026, [CHEATHAM_MINUTES]),
    ],
    cities: [
      area("ashland-city", "Ashland City", [CHEATHAM_COUNTY, { label: "Ashland City", rate: 0.4648 }], "official", 2026, [
        CHEATHAM_MINUTES,
        { label: "Town of Ashland City Ordinance 649", url: "https://www.ashlandcitytn.gov/ordinance/adopting-annual-budget-and-tax-rate-fy27" },
      ]),
      area("kingston-springs", "Kingston Springs", [CHEATHAM_COUNTY, { label: "Kingston Springs", rate: 0.62 }], "official", 2026, [
        CHEATHAM_MINUTES,
        { label: "Town of Kingston Springs Ordinance 26-005", url: "https://kingstonsprings.net/public-documents-%2F-forms" },
      ]),
      area("pegram", "Pegram", [CHEATHAM_COUNTY, { label: "Pegram", rate: 0.32 }], "estimate", 2026, [
        CHEATHAM_MINUTES,
        { label: "Kingston Springs Gazette, Pegram keeps its property tax rate", url: "https://www.ksgazette.com/pegram-approves-1-19m-budget-keeps-property-tax-rate-steady/" },
      ]),
    ],
    note: "Homes outside city limits also pay a fire district tax. Most of the county is in the Cheatham County Fire District.",
  },
  {
    county: "Dickson",
    outside: [area("dickson-county", "Outside city limits", [DICKSON_COUNTY], "estimate", 2025, [COMPTROLLER_2025])],
    cities: [
      area("burns", "Burns", [DICKSON_COUNTY, { label: "Burns (2025 rate)", rate: 0.3333 }], "estimate", 2025, [COMPTROLLER_2025]),
      area("charlotte", "Charlotte", [DICKSON_COUNTY, { label: "Charlotte", rate: 0.1207 }], "estimate", 2025, [
        COMPTROLLER_2025,
        { label: "Town of Charlotte minutes, July 14, 2026 (no rate change)", url: "https://irp.cdn-website.com/df93ff23/files/uploaded/July+14-+2026+Special+Called+Meeting+Minutes.pdf" },
      ]),
      area("dickson-city", "Dickson", [DICKSON_COUNTY, { label: "Dickson", rate: 0.71 }], "estimate", 2025, [
        COMPTROLLER_2025,
        { label: "Dickson Post, city budget keeps the 71-cent rate", url: "https://mainstreetmediatn.com/articles/community-dicksonpost/dickson-city-council-passes-budget-with-employee-pay-raises-no-property-tax-increase/" },
      ]),
      area("vanleer", "Vanleer", [DICKSON_COUNTY, { label: "Vanleer (2025 rate)", rate: 0.0286 }], "estimate", 2025, [COMPTROLLER_2025]),
      area("white-bluff", "White Bluff", [DICKSON_COUNTY, { label: "White Bluff (2025 rate)", rate: 0.6 }], "estimate", 2025, [COMPTROLLER_2025]),
    ],
    note: "Dickson County's 2026 rates weren't published yet when we checked, so these are 2025 rates.",
  },
];

export const countyTax = (county: string) => COUNTY_TAX.find((c) => c.county === county);

/** Finds a tax area by id across a county's outside areas and cities. */
export function taxArea(county: string, id: string): TaxArea | undefined {
  const c = countyTax(county);
  return c ? [...c.outside, ...c.cities].find((a) => a.id === id) : undefined;
}
