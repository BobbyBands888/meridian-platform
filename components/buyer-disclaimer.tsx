import { brandName, type Market } from "@/lib/markets";

/** The note on every buyer page: we only connect people, and nothing here is advice. */
export function BuyerDisclaimer({ market, extra }: { market: Pick<Market, "name" | "state">; extra?: string }) {
  return (
    <p role="note" className="rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed">
      {brandName(market)} only connects buyers, sellers, and local pros. We are not a broker, we don&apos;t hold funds, we take no
      fee tied to any transaction, and we don&apos;t give legal, pricing, or financial advice.{extra ? ` ${extra}` : ""} Talk with a{" "}
      {market.state} real estate attorney about your purchase.
    </p>
  );
}
