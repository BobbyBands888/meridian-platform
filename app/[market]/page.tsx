import type { Metadata } from "next";
import Link from "next/link";
import { CommissionCalculator } from "@/components/commission-calculator";
import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { ListingCard } from "@/components/listing-card";
import { CardGrid } from "@/components/photo-card";
import { SearchBar } from "@/components/search-bar";
import { ButtonLink, Container } from "@/components/ui";
import { zipDirectory } from "@/lib/areas";
import { getGuides } from "@/lib/guides";
import { requireMarket } from "@/lib/market-data";
import { brandName, isLive, marketTagline, serviceArea, type Market } from "@/lib/markets";
import { getActiveListings } from "@/lib/public-listings";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { VENDOR_CATEGORY_LIMIT_NOTE } from "@/lib/site";
import { ComingSoonHome } from "./coming-soon-home";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const steps = [
  {
    title: "Sellers list free",
    body: "Post your home with photos and your asking price. We review each listing before it goes live.",
  },
  {
    title: "Buyers reach owners directly",
    body: "Send a message from any listing. It goes straight to the seller, with no agent in between.",
  },
  {
    title: "Everyone hires their own pros",
    body: "Find attorneys, inspectors, and lenders in our directory. You choose them and you sign with them.",
  },
];

const toolsFor = (market: Market, hasGuides: boolean) => [
  {
    href: "/sell/checklist",
    title: "Pre-sale checklist",
    body: "37 steps from getting ready to list through closing day, with your progress saved as you go.",
    cta: "Open the checklist",
  },
  ...(hasGuides
    ? [
        {
          href: "/guides",
          title: `${market.state} guides`,
          body: "Plain-English guides to selling without an agent and completing the state disclosure form.",
          cta: "Read the guides",
        },
      ]
    : []),
  {
    href: "/vendors",
    title: "Vendor directory",
    body: "Local attorneys, inspectors, photographers, and other pros you contact and hire directly.",
    cta: "Browse vendors",
  },
];

export default async function HomePage({ params }: PageProps<"/[market]">) {
  const market = await requireMarket((await params).market);
  if (!isLive(market)) return <ComingSoonHome market={market} />;

  const [vendorCategories, newestHomes, guides] = await Promise.all([
    getActiveVendorCategories(market.id),
    getActiveListings(market.id, {}, 3),
    getGuides(market.slug),
  ]);
  const tools = toolsFor(market, guides.length > 0);

  return (
    <>
      <section className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">{marketTagline(market)}</h1>
          <div className="mt-8 sm:mt-10">
            <SearchBar />
          </div>
        </Container>
      </section>

      {newestHomes.length > 0 && (
        <section aria-labelledby="newest-heading">
          <Container className="pt-16 sm:pt-20">
            <div className="flex items-end justify-between gap-4">
              <h2 id="newest-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Newest homes
              </h2>
              <Link href="/homes" className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
                See all homes
              </Link>
            </div>
            <div className="mt-8">
              <CardGrid>
                {newestHomes.map((listing) => (
                  <ListingCard key={listing.id} market={market} listing={listing} />
                ))}
              </CardGrid>
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="alerts-heading">
        <Container className="pt-16 sm:pt-20">
          <div className="rounded-3xl bg-surface px-6 py-10 sm:px-10">
            <h2 id="alerts-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Get new {market.name} FSBO listings by email
            </h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
              Hear when owners list new homes. Add a ZIP to focus on one area, or leave it blank for all of {serviceArea(market, market.region)}.
            </p>
            <div className="mt-6 max-w-3xl">
              <ListingAlertsForm zipDirectory={zipDirectory(market)} />
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="commission-heading">
        <Container className="pt-16 sm:pt-20">
          <h2 id="commission-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            What commission costs
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
            Move the slider to your price and see the commission a traditional sale pays.
          </p>
          <div className="mt-8 max-w-3xl">
            <CommissionCalculator brand={brandName(market)} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="how-heading">
        <Container className="py-16 sm:py-20">
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="text-sm font-semibold text-forest">Step {i + 1}</span>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="tools-heading">
        <Container className="pb-16 sm:pb-20">
          <h2 id="tools-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Free tools for selling yourself
          </h2>
          <ul className={`mt-10 grid gap-4 ${tools.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {tools.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-colors hover:border-forest"
                >
                  <h3 className="text-xl font-semibold tracking-tight group-hover:text-forest">{tool.title}</h3>
                  <p className="mt-2 flex-1 text-[17px] leading-relaxed text-muted">{tool.body}</p>
                  <span className="mt-5 text-[15px] font-semibold text-forest">
                    {tool.cta} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {vendorCategories.length > 0 && (
        <section aria-labelledby="vendors-heading" className="bg-surface">
          <Container className="py-16 sm:py-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="vendors-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Local pros for every step
                </h2>
                <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">
                  Every vendor certifies they are licensed and insured before we approve their profile.
                </p>
              </div>
              <Link href="/vendors" className="text-[15px] font-semibold text-forest hover:underline">
                All vendors
              </Link>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {vendorCategories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/vendors/${category.slug}`}
                    className="flex min-h-20 items-center justify-between rounded-xl border border-line bg-white px-5 text-[17px] font-semibold transition-colors hover:border-forest hover:text-forest"
                  >
                    {category.label}
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section aria-labelledby="sell-heading">
        <Container className="pb-10 pt-16 sm:pt-24">
          <div className="rounded-3xl bg-forest px-6 py-12 text-white sm:px-12 sm:py-16">
            <h2 id="sell-heading" className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Selling your {market.name} home yourself?
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
              {guides.length > 0
                ? `List it free and hear from buyers directly. Read our guides first so you know what ${market.state} requires of sellers.`
                : "List it free and hear from buyers directly. Work through the pre-sale checklist first so you know what to expect."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sell">List your home</ButtonLink>
              <ButtonLink href={guides.length > 0 ? "/guides" : "/sell/checklist"} variant="onDark">
                {guides.length > 0 ? "Read the guides" : "Pre-sale checklist"}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        <p className="text-center text-[17px]">
          <Link href="/vendors/join" className="font-semibold text-forest underline-offset-2 hover:underline">
            {market.name} pro? Join the directory free during launch <span aria-hidden="true">→</span>
          </Link>
        </p>
        <p className="mt-1 text-center text-[15px] text-muted">{VENDOR_CATEGORY_LIMIT_NOTE}</p>
      </Container>
    </>
  );
}
