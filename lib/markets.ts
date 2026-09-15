// Market details and helpers shared by server and client code. Rows come from the markets table (lib/market-data.ts);
// ZIP data lives in lib/markets/zips and guides in content/guides/<slug>/.

export type MarketStatus = "live" | "coming_soon";

export type Market = {
  id: string;
  slug: string;
  /** City name used in copy and the brand: "Nashville" makes "Nashville Buys". */
  name: string;
  /** Compact label for admin tables and badges: "NSH". */
  short_name: string;
  /** Region label for the header tag and copy: "Middle Tennessee". */
  region: string;
  state: string;
  state_code: string;
  status: MarketStatus;
  /** Apex domain without www: "nashvillebuys.com". */
  domain: string;
  counties: string[];
  sender_email: string;
  /** Who handles closings, as it reads after "your": "attorney or title company". */
  closing_note: string;
  /** One sentence on the state's seller disclosure rule. */
  disclosure_note: string;
  timezone: string;
  sort_order: number;
  /** When the market first went live; null while coming soon. */
  launched_at: string | null;
};

export const COMPANY = {
  name: "Ownvista",
  domain: "getownvista.com",
  /** Postal address for the site footers and marketing emails (CAN-SPAM). */
  mailingAddress: "Ownvista, PO Box 44, Medford, MA 02155",
} as const;

/** Hostnames (without www) that serve the Ownvista hub page instead of a market. */
export const HUB_DOMAINS: string[] = [COMPANY.domain];

export const DEFAULT_MARKET_SLUG = "nashville";

export const MARKET_SLUG = /^[a-z][a-z0-9-]{1,30}$/;

export const brandName = (market: Pick<Market, "name">) => `${market.name} Buys`;

export const isLive = (market: Pick<Market, "status">) => market.status === "live";

export const marketOrigin = (market: Pick<Market, "domain">) => `https://www.${market.domain}`;

export const marketUrl = (market: Pick<Market, "domain">, path = "/") => `${marketOrigin(market)}${path === "/" ? "" : path}`;

export const hubUrl = () => `https://www.${COMPANY.domain}`;

export function marketTagline(market: Pick<Market, "name">) {
  return `Buy and sell direct. ${market.name}'s FSBO hub.`;
}

export function marketDisclaimer(market: Pick<Market, "name">) {
  return `${brandName(market)} connects buyers, sellers, and professionals directly. We are not a broker, do not hold funds, and do not facilitate closings. All parties should hire independent legal counsel.`;
}

export function marketDescription(market: Pick<Market, "name" | "state_code" | "status">) {
  return market.status === "live"
    ? `${brandName(market)} is a free for-sale-by-owner listing hub for ${market.name}, ${market.state_code}, with a directory of vetted local vendors. Buyers and sellers connect directly.`
    : `${brandName(market)} is launching soon: free listings for selling without an agent in ${market.name}, ${market.state_code}, plus vetted local pros.`;
}

/** "Davidson, Williamson, and Wilson counties" */
export function countyList(market: Pick<Market, "counties">, conjunction = "and") {
  const names = market.counties;
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} County`;
  if (names.length === 2) return `${names[0]} ${conjunction} ${names[1]} counties`;
  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names.at(-1)} counties`;
}

/** The fields client components need, so full rows (sender email, notes) don't ship to the browser. */
export type MarketLink = Pick<Market, "slug" | "name" | "region" | "status" | "domain">;

export const toMarketLink = ({ slug, name, region, status, domain }: Market): MarketLink => ({ slug, name, region, status, domain });
