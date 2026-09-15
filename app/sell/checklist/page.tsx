import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { VendorCard } from "@/components/vendor-card";
import type { PublicVendor, VendorCategoryValue } from "@/lib/database.types";
import { DISCLOSURE_GUIDE_PATH } from "@/lib/listings";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { categoryByValue } from "@/lib/vendors";
import { Checklist, type ChecklistStep } from "./checklist";
import { SubmittedBanner } from "./submitted-banner";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Pre-sale checklist for selling your home by owner",
  description:
    "A free checklist for selling your home yourself in Nashville and Middle Tennessee: photos, pre-listing inspection, paint, staging, repairs, and the Tennessee disclosure, with local pros to help.",
  alternates: { canonical: "/sell/checklist" },
};

// Vendor recommendations, in this order.
const vendorSteps: { category: VendorCategoryValue; heading: string; why: string }[] = [
  { category: "photographer", heading: "Photographers", why: "Listing photos are the first thing buyers see. Bright, wide shots get more inquiries." },
  { category: "home_inspector", heading: "Home Inspectors (pre-listing)", why: "A pre-listing inspection finds surprises before a buyer's inspector does, and helps you complete your disclosure." },
  { category: "painter", heading: "Painters", why: "Fresh, neutral paint is one of the least expensive ways to make rooms look move-in ready." },
  { category: "stager", heading: "Stagers", why: "Staging helps buyers picture themselves in the space, online and at showings." },
  { category: "handyman", heading: "Handymen", why: "Fix the small things buyers notice: sticky doors, loose fixtures, worn caulk." },
];

const PER_CATEGORY = 3;

// Shuffled each time the page regenerates (every few minutes) so recommendations rotate fairly.
function pick(vendors: PublicVendor[]) {
  const copy = [...vendors];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, PER_CATEGORY);
}

export default async function ChecklistPage() {
  const [{ data, error }, activeCategories] = await Promise.all([
    createPublicClient({ tags: [CACHE_TAGS.vendors] }).from("public_vendors").select("*").in("category", vendorSteps.map((s) => s.category)),
    getActiveVendorCategories(),
  ]);
  if (error) throw new Error(`Could not load vendors: ${error.message}`);

  const sections = vendorSteps
    .map((step) => ({ ...step, vendors: pick(data.filter((v) => v.category === step.category)) }))
    .filter((s) => s.vendors.length > 0);
  const hasSection = (c: VendorCategoryValue) => sections.some((s) => s.category === c);
  const hasAttorneys = activeCategories.some((c) => c.value === "attorney");

  const steps: ChecklistStep[] = [
    { id: "photos", title: "Book listing photos", body: "Schedule photos after cleaning, painting, and staging are done.", link: hasSection("photographer") ? { href: "#vendors-photographer", label: "Photographers" } : undefined },
    { id: "inspection", title: "Get a pre-listing inspection", body: "Know what a buyer's inspector will find, and decide what to fix or disclose.", link: hasSection("home_inspector") ? { href: "#vendors-home_inspector", label: "Home inspectors" } : undefined },
    { id: "paint", title: "Touch up or repaint", body: "Patch scuffs and nail holes, and consider neutral colors in busy rooms.", link: hasSection("painter") ? { href: "#vendors-painter", label: "Painters" } : undefined },
    { id: "staging", title: "Stage the main rooms", body: "Declutter and arrange the living room, kitchen, and primary bedroom.", link: hasSection("stager") ? { href: "#vendors-stager", label: "Stagers" } : undefined },
    { id: "repairs", title: "Fix the small things", body: "Doors, drips, loose handles, burned-out bulbs, and worn caulk.", link: hasSection("handyman") ? { href: "#vendors-handyman", label: "Handymen" } : undefined },
    { id: "disclosure", title: "Complete the Tennessee disclosure", body: "Tennessee requires sellers to provide buyers a Residential Property Condition Disclosure.", link: { href: DISCLOSURE_GUIDE_PATH, label: "Read our guide" } },
    { id: "attorney", title: "Line up a real estate attorney", body: "An attorney can prepare or review your contract and handle closing questions.", link: hasAttorneys ? { href: "/vendors/attorneys", label: "Attorneys" } : undefined },
    { id: "price", title: "Set your asking price", body: "Decide on a price you're comfortable with. Nashville Buys doesn't give pricing advice." },
    { id: "list", title: "List your home", body: "List free on Nashville Buys and hear from buyers directly.", link: { href: "/sell", label: "List your home" } },
  ];

  return (
    <>
      <Suspense fallback={null}>
        <SubmittedBanner />
      </Suspense>

      <Container className="pb-6 pt-12 sm:pt-16">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Pre-sale checklist</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Getting ready to sell your home yourself? Work through these steps, and contact local pros below when you need a hand.
          Your checkmarks are saved in this browser. No account needed.
        </p>
      </Container>

      <Container className="pb-12">
        <Checklist steps={steps} />
      </Container>

      <div id="vendors" />
      {sections.length > 0 ? (
        sections.map((section, index) => (
          <section
            key={section.category}
            id={`vendors-${section.category}`}
            aria-labelledby={`heading-${section.category}`}
            className={`scroll-mt-20 ${index % 2 === 0 ? "bg-surface" : ""}`}
          >
            <Container className="py-12 sm:py-14">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id={`heading-${section.category}`} className="text-3xl font-bold tracking-tight">
                    {section.heading}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">{section.why}</p>
                </div>
                <Link href={`/vendors/${categoryByValue(section.category).slug}`} className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
                  See all {categoryByValue(section.category).label.toLowerCase()}
                </Link>
              </div>
              <div className="mt-8">
                <CardGrid>
                  {section.vendors.map((vendor) => (
                    <VendorCard key={vendor.id} vendor={vendor} />
                  ))}
                </CardGrid>
              </div>
            </Container>
          </section>
        ))
      ) : (
        <Container className="pb-10">
          <p className="text-[17px] text-muted">
            We&apos;re approving our first photographers, inspectors, and other local pros now. Check back soon.
          </p>
        </Container>
      )}

      <Container className="py-12">
        <div className="rounded-2xl border border-line p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Know a great local pro?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Free for founding vendors during our Nashville launch. When we introduce pricing, founding vendors get first notice
            and a locked-in rate.
          </p>
          <ButtonLink href="/vendors/join" variant="secondary" className="mt-5">
            Join the vendor directory
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
