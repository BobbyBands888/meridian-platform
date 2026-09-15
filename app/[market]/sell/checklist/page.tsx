import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CourseForm } from "@/components/course-form";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { VendorCard } from "@/components/vendor-card";
import { getChecklist, type ChecklistStep } from "@/lib/checklist";
import { getDisclosureGuidePath } from "@/lib/guides";
import { requireMarket } from "@/lib/market-data";
import { VENDOR_CATEGORY_LIMIT_NOTE } from "@/lib/site";
import type { PublicVendor, VendorCategoryValue } from "@/lib/database.types";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { categoryByValue } from "@/lib/vendors";
import { Checklist, type ChecklistSectionView } from "./checklist";
import { SubmittedBanner } from "./submitted-banner";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[market]/sell/checklist">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  const checklist = await getChecklist(market);
  const steps = checklist.sections.reduce((n, s) => n + s.steps.length, 0);
  return {
    title: checklist.title || "Pre-sale checklist",
    description: `A free ${steps}-step checklist for selling your home by owner in ${market.name} and ${market.region}, with local pros for each step. General information, not legal, financial, or pricing advice.`,
    alternates: { canonical: "/sell/checklist" },
  };
}

// Recommendation order: the get-your-home-ready trades first, then any other categories the checklist mentions.
const PREFERRED_ORDER: VendorCategoryValue[] = ["photographer", "home_inspector", "painter", "stager", "handyman"];
const PER_CATEGORY = 3;

// Site links for steps that talk about something the site has a page for. The disclosure guide is per market.
function contentLinksFor(disclosureGuide: string | null) {
  const links: { test: RegExp; href: string; label: string }[] = [{ test: /^Write the listing/i, href: "/sell", label: "Start your listing" }];
  if (disclosureGuide) links.push({ test: /seller's disclosure/i, href: disclosureGuide, label: "Read our disclosure guide" });
  return (step: ChecklistStep) => links.filter((l) => l.test.test(step.title)).map(({ href, label }) => ({ href, label }));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Verified vendors come first; each group is shuffled when the page regenerates (every few minutes) so
// recommendations rotate fairly.
function pick(vendors: PublicVendor[]) {
  return [...shuffle(vendors.filter((v) => v.verified_at)), ...shuffle(vendors.filter((v) => !v.verified_at))].slice(0, PER_CATEGORY);
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed" role="note">
      {text}
    </p>
  );
}

export default async function ChecklistPage({ params }: PageProps<"/[market]/sell/checklist">) {
  const market = await requireMarket((await params).market);
  const [checklist, disclosureGuide] = await Promise.all([getChecklist(market), getDisclosureGuidePath(market.slug)]);
  const contentLinks = contentLinksFor(disclosureGuide);
  const mentioned = [...new Set(checklist.sections.flatMap((s) => s.steps.flatMap((step) => step.categories)))];
  const categoryOrder = [...PREFERRED_ORDER.filter((c) => mentioned.includes(c)), ...mentioned.filter((c) => !PREFERRED_ORDER.includes(c))];

  const { data, error } = categoryOrder.length
    ? await createPublicClient({ tags: [CACHE_TAGS.vendors] }).from("public_vendors").select("*").eq("market_id", market.id).in("category", categoryOrder)
    : { data: [] as PublicVendor[], error: null };
  if (error) throw new Error(`Could not load vendors: ${error.message}`);

  const vendorSections = categoryOrder
    .map((category) => ({ category, info: categoryByValue(category), vendors: pick(data.filter((v) => v.category === category)) }))
    .filter((s) => s.vendors.length > 0);
  const withVendors = new Set(vendorSections.map((s) => s.category));

  // Steps tagged with a category link to that category's cards below, when it has approved vendors.
  const sections: ChecklistSectionView[] = checklist.sections.map((section) => ({
    number: section.number,
    title: section.title,
    steps: section.steps.map((step) => ({
      id: step.id,
      number: step.number,
      title: step.title,
      body: step.body,
      links: [
        ...step.categories.filter((c) => withVendors.has(c)).map((c) => ({ href: `#vendors-${c}`, label: `Local ${categoryByValue(c).label.toLowerCase()}` })),
        ...contentLinks(step),
      ],
    })),
  }));

  return (
    <>
      <Suspense fallback={null}>
        <SubmittedBanner />
      </Suspense>

      <Container className="pb-6 pt-12 sm:pt-16">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{checklist.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Work through each section at your own pace. Your checkmarks are saved in this browser, with no account needed.
        </p>
        <div className="mt-6 max-w-3xl">
          <Disclaimer text={checklist.disclaimer} />
        </div>
      </Container>

      <Container className="pb-12">
        <Checklist sections={sections} />
      </Container>

      {vendorSections.length > 0 && (
        <div id="vendors">
          <Container className="pb-2">
            <h2 className="text-3xl font-bold tracking-tight">Local pros for these steps</h2>
            <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
              Independent businesses you contact and hire directly. Verified vendors are listed first.
            </p>
          </Container>
          {vendorSections.map((section, index) => (
            <section
              key={section.category}
              id={`vendors-${section.category}`}
              aria-labelledby={`heading-${section.category}`}
              className={`scroll-mt-20 ${index % 2 === 0 ? "bg-surface" : ""}`}
            >
              <Container className="py-12 sm:py-14">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <h3 id={`heading-${section.category}`} className="text-2xl font-bold tracking-tight">
                    {section.info.label}
                  </h3>
                  <Link href={`/vendors/${section.info.slug}`} className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
                    See all {section.info.label.toLowerCase()}
                  </Link>
                </div>
                <div className="mt-6">
                  <CardGrid>
                    {section.vendors.map((vendor) => (
                      <VendorCard key={vendor.id} market={market} vendor={vendor} />
                    ))}
                  </CardGrid>
                </div>
              </Container>
            </section>
          ))}
        </div>
      )}

      <Container className="space-y-6 py-12">
        <div className="max-w-3xl">
          <Disclaimer text={checklist.closingNote || checklist.disclaimer} />
        </div>
        <div className="rounded-2xl bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Rather take it a day at a time?
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
            Selling without an agent in {market.name}, one email a day for a week. Each one covers a section of this
            checklist, with the guides and local pros for that step.
          </p>
          <div className="mt-5 max-w-2xl">
            <CourseForm source="/sell/checklist" />
          </div>
        </div>

        <div className="rounded-2xl border border-line p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Ready to list?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            List your home free and hear from buyers directly. Local pros can join the directory too. {VENDOR_CATEGORY_LIMIT_NOTE}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/sell">List your home</ButtonLink>
            <ButtonLink href="/vendors/join" variant="secondary">
              Join as a local pro
            </ButtonLink>
          </div>
        </div>
      </Container>
    </>
  );
}
