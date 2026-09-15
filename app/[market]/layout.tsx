import type { Metadata } from "next";
import { LegalBanner } from "@/components/legal-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMarkets, requireMarket } from "@/lib/market-data";
import { brandName, hubUrl, isLive, marketDescription, marketDisclaimer, marketOrigin, toMarketLink } from "@/lib/markets";

// Every market is prerendered; a market added later renders on its first request.
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getMarkets()).map((m) => ({ market: m.slug }));
}

export async function generateMetadata({ params }: LayoutProps<"/[market]">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  const brand = brandName(market);
  return {
    metadataBase: new URL(marketOrigin(market)),
    title: {
      default: isLive(market) ? `${brand} · ${market.name} FSBO homes and local vendors` : `${brand} · Launching soon`,
      template: `%s · ${brand}`,
    },
    description: marketDescription(market),
    applicationName: brand,
    openGraph: { type: "website", siteName: brand, locale: "en_US", images: [{ url: "/og-image", width: 1200, height: 630, alt: brand }] },
    twitter: { card: "summary_large_image", images: ["/og-image"] },
  };
}

export default async function MarketLayout({ children, params }: LayoutProps<"/[market]">) {
  const market = await requireMarket((await params).market);
  const liveMarkets = (await getMarkets()).filter(isLive).map(toMarketLink);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <SiteHeader market={toMarketLink(market)} liveMarkets={liveMarkets} hubUrl={hubUrl()} />
      <LegalBanner brand={brandName(market)} text={marketDisclaimer(market)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter market={market} />
    </>
  );
}
