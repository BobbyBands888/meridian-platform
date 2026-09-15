import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { getMarkets } from "@/lib/market-data";
import { brandName, isLive, marketUrl } from "@/lib/markets";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HubPage() {
  const markets = await getMarkets();

  return (
    <Container className="py-16 sm:py-24">
      <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">Buy and sell direct, city by city.</h1>
      <p className="mt-5 max-w-2xl text-xl leading-relaxed text-muted">
        Free for-sale-by-owner listings and a directory of vetted local pros. Pick your market.
      </p>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((market) => {
          const live = isLive(market);
          return (
            <li key={market.slug}>
              <a
                href={marketUrl(market)}
                className="group flex h-full flex-col rounded-2xl border border-line p-6 transition-colors hover:border-forest"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight group-hover:text-forest">{brandName(market)}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider ${
                      live ? "bg-forest text-white" : "border border-warm/40 bg-warm/10 text-ink"
                    }`}
                  >
                    {live ? "Live" : "Coming soon"}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-[16px] leading-relaxed text-muted">
                  {market.region}, {market.state}
                </p>
                <span className="mt-5 text-[15px] font-semibold text-forest">
                  {market.domain} <span aria-hidden="true">→</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
