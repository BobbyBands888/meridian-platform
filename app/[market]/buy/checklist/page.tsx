import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { requireBuyerMarket } from "@/lib/buyer";
import { getChecklist } from "@/lib/checklist";
import { getDisclosureGuidePath, getGuide } from "@/lib/guides";
import { serviceArea } from "@/lib/markets";
import { BuyerChecklistPage, sourced, type StepLink } from "../checklist-page";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[market]/buy/checklist">): Promise<Metadata> {
  const market = await requireBuyerMarket((await params).market);
  const checklist = await getChecklist(market, "buyer");
  const steps = checklist.sections.reduce((n, s) => n + s.steps.length, 0);
  return {
    title: `Home buyer checklist for ${market.name}`,
    description: `A free ${steps}-step checklist for buying a home in ${serviceArea(market, market.region)}, including buying direct from an owner: pre-approval, the ${market.state} disclosure, earnest money, inspections, and closing. General information, not legal or financial advice.`,
    alternates: { canonical: "/buy/checklist" },
  };
}

export default async function BuyerChecklist({ params }: PageProps<"/[market]/buy/checklist">) {
  const market = await requireBuyerMarket((await params).market);
  const source = "buyer_checklist" as const;
  const [checklist, disclosureGuide, closingCosts, inspectionCost] = await Promise.all([
    getChecklist(market, "buyer"),
    getDisclosureGuidePath(market.slug),
    getGuide(market.slug, "tennessee-buyer-closing-costs"),
    getGuide(market.slug, "home-inspection-cost-nashville"),
  ]);

  const calculator: StepLink = { href: sourced("/buy/calculator", source), label: "Estimate your costs" };
  const stepLinks: Record<string, StepLink[]> = {
    budget: [calculator],
    cash: [calculator, ...(closingCosts ? [{ href: sourced(`/guides/${closingCosts.slug}`, source), label: "Closing costs explained" }] : [])],
    credit: [{ href: "https://www.annualcreditreport.com/", label: "AnnualCreditReport.com" }],
    areas: [calculator, { href: "/homes/areas", label: "Browse areas" }],
    alerts: [{ href: "#alerts", label: "Get listing alerts" }],
    ownership: [{ href: "https://assessment.cot.tn.gov/TPAD", label: "Tennessee property assessment search" }],
    "flood-hoa": [{ href: "https://msc.fema.gov/portal/home", label: "FEMA Flood Map Service Center" }],
    ...(disclosureGuide ? { disclosure: [{ href: disclosureGuide, label: "About the disclosure form" }] } : {}),
    ...(inspectionCost ? { inspection: [{ href: sourced(`/guides/${inspectionCost.slug}`, source), label: "What drives inspection cost" }] } : {}),
    ...(closingCosts ? { "closing-disclosure": [{ href: sourced(`/guides/${closingCosts.slug}`, source), label: "Closing costs explained" }] } : {}),
    "closing-file": [{ href: sourced("/buy/moved-in", source), label: "New homeowner checklist" }],
  };

  return (
    <BuyerChecklistPage
      market={market}
      checklist={checklist}
      kind="buyer"
      source={source}
      intro="Work through each stage at your own pace. Your checkmarks are saved in this browser, with no account needed."
      stepLinks={stepLinks}
      alerts
      footer={
        <div className="rounded-2xl bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Ready to look?</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
            Browse homes listed by their owners, or run the numbers for a price you have in mind.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/homes">Browse homes</ButtonLink>
            <ButtonLink href={calculator.href} variant="secondary">
              Cost calculator
            </ButtonLink>
          </div>
        </div>
      }
    />
  );
}
