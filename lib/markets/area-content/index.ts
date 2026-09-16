import { nashville } from "./nashville";
import type { MarketAreaContent } from "./types";

export type { AreaContent, MarketAreaContent } from "./types";

/** Area page content by market slug. Markets without an entry use the template intro alone on every area page. */
export const marketAreaContent: Record<string, MarketAreaContent> = { nashville };
