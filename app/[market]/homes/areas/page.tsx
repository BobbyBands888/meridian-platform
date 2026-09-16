import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";
import { areasByCounty, marketAreas, zipPhrase } from "@/lib/areas";
import { requireMarket } from "@/lib/market-data";
import { countyList, serviceArea } from "@/lib/markets";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[market]/homes/areas">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  return {
    title: `${market.name} neighborhoods and towns`,
    description: `Every neighborhood and town ${market.name} Buys covers across ${serviceArea(market, countyList(market))}, grouped by county. Browse for-sale-by-owner homes area by area.`,
    alternates: { canonical: "/homes/areas" },
  };
}

// Static per market: the areas come from the ZIP map in the code, not the database.
export default async function AreasPage({ params }: PageProps<"/[market]/homes/areas">) {
  const market = await requireMarket((await params).market);
  const groups = areasByCounty(market);
  const total = marketAreas(market).length;

  return (
    <>
      <PageHeader
        title={`${market.name} neighborhoods and towns`}
        intro={`All ${total} areas we cover across ${serviceArea(market, countyList(market))}. Pick one to see the homes owners have listed there.`}
      />
      <Container className="pb-16">
        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.county} aria-labelledby={`county-${group.county.toLowerCase()}`}>
              <h2 id={`county-${group.county.toLowerCase()}`} className="text-2xl font-bold tracking-tight">
                {group.county} County
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.areas.map((area) => (
                  <li key={area.slug}>
                    <Link
                      href={`/homes/${area.slug}`}
                      className="group flex h-full flex-col justify-center rounded-xl border border-line px-5 py-4 transition-colors hover:border-forest"
                    >
                      <span className="font-semibold group-hover:text-forest">{area.name}</span>
                      <span className="mt-0.5 text-[13px] text-muted">{zipPhrase(area.zips)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
