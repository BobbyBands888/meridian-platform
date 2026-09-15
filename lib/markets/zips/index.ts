import { nashville } from "./nashville";
import { orlando } from "./orlando";
import { tampa } from "./tampa";
import type { MarketZipData } from "./types";

export type { MarketZipData, ZipInfo } from "./types";

/** ZIP data by market slug. A new market adds its file here (see SETUP.md, "Launch a new market"). */
export const marketZips: Record<string, MarketZipData> = { nashville, tampa, orlando };
