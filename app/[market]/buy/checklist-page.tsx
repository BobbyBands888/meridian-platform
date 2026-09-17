import { BuyerDisclaimer } from "@/components/buyer-disclaimer";
import { Checklist, type ChecklistSectionView } from "@/components/checklist";
import { ListingAlertsForm } from "@/components/listing-alerts-form";
import { Container } from "@/components/ui";
import { VendorModule, VendorModuleNote } from "@/components/vendor-module";
import { zipDirectory } from "@/lib/areas";
import { withSource, type PageSource } from "@/lib/attribution";
import type { Checklist as ChecklistData } from "@/lib/checklist";
import type { Market } from "@/lib/markets";
import { loadModuleVendors } from "@/lib/vendor-modules";
import { categorySentenceName } from "@/lib/vendors";

export type StepLink = { href: string; label: string };

type Props = {
  market: Market;
  checklist: ChecklistData;
  kind: "buyer" | "moved_in";
  source: PageSource;
  intro: string;
  /** Extra links for particular steps, by step id. */
  stepLinks: Record<string, StepLink[]>;
  /** Show the listing alert signup (the buyer checklist's "Set up listing alerts" step points to it). */
  alerts?: boolean;
  footer?: React.ReactNode;
};

/**
 * Shared layout for the buyer and new homeowner checklists: the checklist, then a vendor module for every category a step
 * mentions (with honest empty states), then optional alerts. Steps link down to their category's module.
 */
export async function BuyerChecklistPage({ market, checklist, kind, source, intro, stepLinks, alerts, footer }: Props) {
  const categories = [...new Set(checklist.sections.flatMap((s) => s.steps.flatMap((step) => step.categories)))];
  const vendors = await loadModuleVendors(market.id, categories);

  const sections: ChecklistSectionView[] = checklist.sections.map((section) => ({
    number: section.number,
    title: section.title,
    steps: section.steps.map((step) => ({
      id: step.id,
      number: step.number,
      title: step.title,
      body: step.body,
      links: [
        ...(stepLinks[step.id] ?? []),
        ...step.categories.map((c) => ({ href: `#vendors-${c}`, label: `Local ${categorySentenceName(c).plural}` })),
      ],
    })),
  }));

  return (
    <>
      <Container className="pb-6 pt-12 sm:pt-16">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{checklist.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>
        <div className="mt-6 max-w-3xl">
          <BuyerDisclaimer market={market} />
        </div>
      </Container>

      <Container className="pb-12">
        <Checklist sections={sections} kind={kind} />
      </Container>

      {categories.length > 0 && (
        <section id="vendors" aria-labelledby="vendors-heading" className="bg-surface">
          <Container className="py-12 sm:py-14">
            <h2 id="vendors-heading" className="text-3xl font-bold tracking-tight">
              Local pros for these steps
            </h2>
            <div className="mt-2 max-w-2xl">
              <VendorModuleNote />
            </div>
            <div className="mt-8 space-y-10">
              {categories.map((category) => (
                <VendorModule key={category} market={market} category={category} vendors={vendors.get(category) ?? []} source={source} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <Container className="space-y-6 py-12">
        {alerts && (
          <section id="alerts" aria-labelledby="alerts-heading" className="scroll-mt-24 rounded-2xl border border-line p-6 sm:p-8">
            <h2 id="alerts-heading" className="text-xl font-semibold tracking-tight">
              Get new {market.name} FSBO listings by email
            </h2>
            <p className="mb-4 mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">We&apos;ll email you when owners list new homes.</p>
            <div className="max-w-2xl">
              <ListingAlertsForm zipDirectory={zipDirectory(market)} source={source} />
            </div>
          </section>
        )}
        {checklist.closingNote && (
          <p className="max-w-3xl rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed" role="note">
            {checklist.closingNote}
          </p>
        )}
        {footer}
      </Container>
    </>
  );
}

/** A site link tagged with this page's source. */
export const sourced = (path: string, source: PageSource) => withSource(path, source);
