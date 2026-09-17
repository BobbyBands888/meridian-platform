import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { requireBuyerMarket } from "@/lib/buyer";
import { getChecklist } from "@/lib/checklist";
import { serviceArea } from "@/lib/markets";
import { BuyerChecklistPage, sourced, type StepLink } from "../checklist-page";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[market]/buy/moved-in">): Promise<Metadata> {
  const market = await requireBuyerMarket((await params).market);
  const checklist = await getChecklist(market, "moved_in");
  const items = checklist.sections.reduce((n, s) => n + s.steps.length, 0);
  return {
    title: `New homeowner checklist for ${market.name}: your first year`,
    description: `${items} things to do in your first year in a ${serviceArea(market, market.region)} home: locks, alarms, HVAC, termites, radon, roof and crawlspace checks, and ${market.state} property tax relief and freeze programs.`,
    alternates: { canonical: "/buy/moved-in" },
  };
}

export default async function MovedInChecklist({ params }: PageProps<"/[market]/buy/moved-in">) {
  const market = await requireBuyerMarket((await params).market);
  const source = "moved_in" as const;
  const checklist = await getChecklist(market, "moved_in");

  const stepLinks: Record<string, StepLink[]> = {
    radon: [{ href: "https://www.tn.gov/environment/stewardship/programs/radon.html", label: "Tennessee radon program" }],
    "tax-relief": [
      { href: "https://comptroller.tn.gov/office-functions/pa/property-taxes/property-tax-programs/tax-relief.html", label: "Property Tax Relief" },
      { href: "https://comptroller.tn.gov/office-functions/pa/property-taxes/property-tax-programs/property-tax-freeze.html", label: "Property Tax Freeze" },
    ],
  };

  return (
    <BuyerChecklistPage
      market={market}
      checklist={checklist}
      kind="moved_in"
      source={source}
      intro="The first year in a new home, one task at a time. Your checkmarks are saved in this browser, with no account needed."
      stepLinks={stepLinks}
      footer={
        <div className="rounded-2xl bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Still buying?</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
            The buyer checklist covers everything from pre-approval to getting your keys.
          </p>
          <div className="mt-5">
            <ButtonLink href={sourced("/buy/checklist", source)} variant="secondary">
              Buyer checklist
            </ButtonLink>
          </div>
        </div>
      }
    />
  );
}
