import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BuyerCostCalculator } from "@/components/buyer-cost-calculator";
import { BuyerDisclaimer } from "@/components/buyer-disclaimer";
import { Container, PageHeader } from "@/components/ui";
import { VendorModule, VendorModuleNote } from "@/components/vendor-module";
import { withSource } from "@/lib/attribution";
import { requireBuyerMarket } from "@/lib/buyer";
import { CHECKED_ON, LOAN_SOURCES } from "@/lib/buyer-costs/rates";
import { formatGuideDate, getGuide } from "@/lib/guides";
import { countyList } from "@/lib/markets";
import { loadModuleVendors } from "@/lib/vendor-modules";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[market]/buy/calculator">): Promise<Metadata> {
  const market = await requireBuyerMarket((await params).market);
  return {
    title: `${market.name} home buyer cost calculator`,
    description: `Estimate your monthly payment and cash to close for a home in ${countyList(market)}: ${market.state} property tax by county and city, transfer and mortgage taxes, PMI, FHA, and VA. Estimates only.`,
    alternates: { canonical: "/buy/calculator" },
  };
}

const MODULE_CATEGORIES = ["lender", "attorney"] as const;

export default async function CalculatorPage({ params }: PageProps<"/[market]/buy/calculator">) {
  const market = await requireBuyerMarket((await params).market);
  const [vendors, closingCosts] = await Promise.all([
    loadModuleVendors(market.id, [...MODULE_CATEGORIES]),
    getGuide(market.slug, "tennessee-buyer-closing-costs"),
  ]);

  return (
    <>
      <PageHeader
        title="What will this home really cost?"
        intro="Estimate your monthly payment and the cash you'll need to close. The math runs in your browser; nothing you enter is saved or sent to us."
      >
        <p className="mt-4 text-[15px] text-muted">
          Rates as of {formatGuideDate(CHECKED_ON)}.{" "}
          <a href="#sources" className="font-medium text-forest underline underline-offset-2">
            See sources
          </a>
        </p>
      </PageHeader>

      <Container>
        <Suspense fallback={<div className="h-[900px] rounded-3xl border border-line" aria-hidden="true" />}>
          <BuyerCostCalculator />
        </Suspense>

        <div className="mt-8 max-w-3xl">
          <BuyerDisclaimer market={market} extra="These are estimates only, not a loan offer or financial advice. We don't use live rate feeds." />
        </div>
      </Container>

      <section aria-labelledby="calc-pros" className="mt-12 bg-surface">
        <Container className="py-12 sm:py-14">
          <h2 id="calc-pros" className="text-3xl font-bold tracking-tight">
            Get real numbers
          </h2>
          <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
            A lender&apos;s Loan Estimate shows your actual rate and fees, and a closing attorney or title company can tell you what
            closing will cost.
          </p>
          <div className="mt-2 max-w-2xl">
            <VendorModuleNote />
          </div>
          <div className="mt-8 space-y-10">
            {MODULE_CATEGORIES.map((category) => (
              <VendorModule key={category} market={market} category={category} vendors={vendors.get(category) ?? []} source="calculator" />
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <Link href={withSource("/buy/checklist", "calculator")} className="rounded-2xl border border-line p-5 font-semibold hover:border-forest hover:text-forest">
            Buyer checklist <span aria-hidden="true">→</span>
          </Link>
          {closingCosts && (
            <Link href={withSource(`/guides/${closingCosts.slug}`, "calculator")} className="rounded-2xl border border-line p-5 font-semibold hover:border-forest hover:text-forest">
              Closing costs explained <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>

        <section id="sources" aria-labelledby="sources-heading" className="mt-12 max-w-3xl scroll-mt-24">
          <h2 id="sources-heading" className="text-xl font-semibold tracking-tight">
            Sources and assumptions
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Checked {formatGuideDate(CHECKED_ON)}. Property tax uses the price as the appraised value. Each county and city rate
            shows its own source and tax year next to the rate; rates marked &ldquo;estimate&rdquo; weren&apos;t yet in an official
            source, so confirm them on your trustee&apos;s bill.
          </p>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed">
            {LOAN_SOURCES.map((s) => (
              <li key={s.figure}>
                <span className="font-medium">{s.figure}.</span>{" "}
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-2">
                  {s.sourceLabel}
                </a>{" "}
                <span className="text-muted">(as of {s.asOf})</span>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </>
  );
}
