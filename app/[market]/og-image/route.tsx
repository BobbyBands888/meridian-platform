import { ImageResponse } from "next/og";
import { getMarket, getMarkets } from "@/lib/market-data";
import { brandName, isLive, marketTagline } from "@/lib/markets";

export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getMarkets()).map((m) => ({ market: m.slug }));
}

// Default social preview for a market's pages (set in the market layout). Listing and vendor pages use their own photos.
export async function GET(_request: Request, { params }: RouteContext<"/[market]/og-image">) {
  const market = await getMarket((await params).market);
  if (!market) return new Response("Not found", { status: 404 });
  const headline = isLive(market) ? marketTagline(market) : `Launching soon in ${market.region}.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#ffffff",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#1F4D3A", display: "flex" }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1F4D3A" }}>{brandName(market)}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{headline}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#5b5f5d" }}>
          <div style={{ width: 48, height: 8, background: "#D97A3A" }} />
          {market.domain}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
