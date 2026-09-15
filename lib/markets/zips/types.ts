export type ZipInfo = { city: string; area: string; county: string };

/** One market's service area: its counties in display order, and every residential ZIP it covers. */
export type MarketZipData = { counties: string[]; zips: Record<string, ZipInfo> };
