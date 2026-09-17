import type { Metadata } from "next";
import Link from "next/link";
import { BuyerDisclaimer } from "@/components/buyer-disclaimer";
import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { ListingCard } from "@/components/listing-card";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { VendorModule, VendorModuleNote } from "@/components/vendor-module";
import { zipDirectory } from "@/lib/areas";
import { withSource } from "@/lib/attribution";
import { requireBuyerMarket } from "@/lib/buyer";
import { getGuides } from "@/lib/guides";
import { countyList, serviceArea } from "@/lib/markets";
import { getActiveListings } from "@/lib/public-listings";
import { loadModuleVendors } from "@/lib/vendor-modules";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[market]/buy">): Promise<Metadata> {
  const market = await requireBuyerMarket((await params).market);
  return {
    title: `Buy a home in ${market.name} direct from the owner`,
    description: `For home buyers in ${serviceArea(market, market.region)}: for-sale-by-owner homes, a ${market.state} buyer checklist, a cost calculator with county property tax, and local lenders, inspectors, and closing attorneys.`,
    alternates: { canonical: "/buy" },
  };
}

const SOURCE = "buy_page" as const;
const PRO_CATEGORIES = ["lender", "home_inspector", "attorney", "home_insurance"] as const;

export default async function BuyPage({ params }: PageProps<"/[market]/buy">) {
  const market = await requireBuyerMarket((await params).market);
  const [homes, vendors, guides] = await Promise.all([
    getActiveListings(market.id, {}, 3),
    loadModuleVendors(market.id, [...PRO_CATEGORIES]),
    getGuides(market.slug),
  ]);
  const buyerGuides = guides.filter((g) => g.audience === "buyer");

  const tools = [
    {
      href: withSource("/buy/checklist", SOURCE),
      title: "Buyer checklist",
      body: `Every step from pre-approval to getting your keys, including what's different when you buy direct from an owner in ${market.state}.`,
    },
    {
      href: withSource("/buy/calculator", SOURCE),
      title: "Cost calculator",
      body: `Monthly payment and cash to close, with ${market.state} property tax for ${countyList(market)}.`,
    },
    {
      href: withSource("/buy/moved-in", SOURCE),
      title: "New homeowner checklist",
      body: "Your first year: locks, HVAC, termites, radon, and property tax relief programs.",
    },
  ];

  return (
    <>
      <section className="border-b border-line">
        <Container className="pb-12 pt-10 sm:pb-16 sm:pt-12">
          <Link href="/homes" className="inline-flex min-h-10 items-center text-[16px] font-semibold text-forest hover:underline">
            Browse homes for sale by owner <span aria-hidden="true">&nbsp;→</span>
          </Link>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Buying a home in {serviceArea(market, market.name)}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            Buy directly from owners, with free tools to plan every step and local pros you hire yourself.
          </p>
        </Container>
      </section>

      <section aria-labelledby="homes-heading">
        <Container className="py-12 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="homes-heading" className="text-3xl font-bold tracking-tight">
              Homes for sale by owner
            </h2>
            {homes.length > 0 && (
              <Link href="/homes" className="text-[15px] font-semibold text-forest hover:underline">
                See all homes <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          {homes.length > 0 ? (
            <div className="mt-6">
              <CardGrid>
                {homes.map((listing, i) => (
                  <ListingCard key={listing.id} market={market} listing={listing} priority={i === 0} />
                ))}
              </CardGrid>
            </div>
          ) : (
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
              {market.name} listings are just getting started. Sign up below and we&apos;ll email you when owners list new homes. Until
              then, the checklist and calculator will get you ready.
            </p>
          )}
          <div id="alerts" className="mt-8 max-w-2xl scroll-mt-24 rounded-2xl border border-line p-6">
            <h3 className="text-lg font-semibold tracking-tight">Get new listings by email</h3>
            <p className="mb-4 mt-1 text-[15px] leading-relaxed text-muted">Add a ZIP to hear only about homes in that area.</p>
            <ListingAlertsForm zipDirectory={zipDirectory(market)} source={SOURCE} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="tools-heading" className="bg-surface">
        <Container className="py-12 sm:py-14">
          <h2 id="tools-heading" className="text-3xl font-bold tracking-tight">
            Plan your purchase
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.title}>
                <Link href={tool.href} className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-colors hover:border-forest">
                  <span className="text-xl font-semibold tracking-tight">{tool.title}</span>
                  <span className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{tool.body}</span>
                  <span className="mt-4 text-[15px] font-semibold text-forest">
                    Open <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="pros-heading">
        <Container className="py-12 sm:py-14">
          <h2 id="pros-heading" className="text-3xl font-bold tracking-tight">
            Local pros every buyer needs
          </h2>
          <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
            A lender, a home inspector, and a closing attorney or title company, plus insurance before closing.
          </p>
          <div className="mt-2 max-w-2xl">
            <VendorModuleNote />
          </div>
          <div className="mt-8 space-y-10">
            {PRO_CATEGORIES.map((category) => (
              <VendorModule key={category} market={market} category={category} vendors={vendors.get(category) ?? []} source={SOURCE} />
            ))}
          </div>
        </Container>
      </section>

      {buyerGuides.length > 0 && (
        <section aria-labelledby="guides-heading" className="bg-surface">
          <Container className="py-12 sm:py-14">
            <h2 id="guides-heading" className="text-3xl font-bold tracking-tight">
              Buyer guides
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {buyerGuides.map((g) => (
                <li key={g.slug}>
                  <Link href={withSource(`/guides/${g.slug}`, SOURCE)} className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-colors hover:border-forest">
                    <span className="text-lg font-semibold tracking-tight">{g.title}</span>
                    <span className="mt-2 text-[15px] leading-relaxed text-muted">{g.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <Container className="space-y-6 py-12">
        <div className="max-w-3xl">
          <BuyerDisclaimer market={market} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/homes">Browse homes</ButtonLink>
          <ButtonLink href={withSource("/buy/checklist", SOURCE)} variant="secondary">
            Start the checklist
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
