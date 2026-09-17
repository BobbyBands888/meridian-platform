import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { VendorCard } from "@/components/vendor-card";
import { VendorModule, VendorModuleNote } from "@/components/vendor-module";
import { withSource } from "@/lib/attribution";
import type { PublicVendor } from "@/lib/database.types";
import { formatGuideDate, getGuide, getGuides } from "@/lib/guides";
import { getMarket, requireMarket } from "@/lib/market-data";
import { brandName, COMPANY, isLive, marketUrl } from "@/lib/markets";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { fairVendorOrder } from "@/lib/vendor-order";
import { categoryByValue } from "@/lib/vendors";

// Vendor recommendations refresh with the vendors cache tag; the article itself only changes on deploy.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams({ params }: { params: { market: string } }) {
  const market = await getMarket(params.market);
  if (!market || !isLive(market)) return [];
  return (await getGuides(market.slug)).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[market]/guides/[slug]">): Promise<Metadata> {
  const { market: marketSlug, slug } = await params;
  const market = await requireMarket(marketSlug);
  const guide = await getGuide(market.slug, slug);
  if (!guide) return {};
  const url = `/guides/${guide.slug}`;
  return {
    title: { absolute: `${guide.seoTitle} · ${brandName(market)}` },
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: guide.seoTitle,
      description: guide.description,
      url,
      siteName: brandName(market),
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
    twitter: { card: "summary_large_image", title: guide.seoTitle, description: guide.description },
  };
}

const PER_CATEGORY = 3;

export default async function GuidePage({ params }: PageProps<"/[market]/guides/[slug]">) {
  const { market: marketSlug, slug } = await params;
  const market = await requireMarket(marketSlug);
  const guide = await getGuide(market.slug, slug);
  if (!guide) notFound(); // The layout already 404s; this narrows the type.

  const [{ data: vendors }, allGuides, activeCategories] = await Promise.all([
    guide.vendorCategories.length
      ? createPublicClient({ tags: [CACHE_TAGS.vendors] })
          .from("public_vendors")
          .select("*")
          .eq("market_id", market.id)
          .in("category", guide.vendorCategories)
      : Promise.resolve({ data: [] as PublicVendor[] }),
    getGuides(market.slug),
    getActiveVendorCategories(market.id),
  ]);

  const buyerGuide = guide.audience === "buyer";
  const vendorSections = guide.vendorCategories
    .map((category) => ({ info: categoryByValue(category), vendors: fairVendorOrder((vendors ?? []).filter((v) => v.category === category), category).slice(0, PER_CATEGORY) }))
    .filter((s) => s.vendors.length > 0);
  const otherGuides = allGuides.filter((g) => g.slug !== guide.slug);
  // Only point readers at directory categories that currently have approved vendors.
  const browseCategories = guide.vendorCategories.filter((c) => activeCategories.some((a) => a.value === c));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    mainEntityOfPage: marketUrl(market, `/guides/${guide.slug}`),
    author: { "@type": "Organization", name: brandName(market) },
    publisher: { "@type": "Organization", name: COMPANY.name },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
          <Link href="/guides" className="hover:text-ink">
            Guides
          </Link>
        </nav>

        <article className="mx-auto mt-6 max-w-2xl">
          <header>
            <p className="text-[14px] font-medium text-forest">
              {guide.readingMinutes} min read · Updated {formatGuideDate(guide.updatedAt)}
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{guide.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">{guide.description}</p>
          </header>

          <p role="note" className="mt-8 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed">
            General information, not legal, financial, or pricing advice. {brandName(market)} is not a broker and does not
            facilitate closings. Talk with a {market.state} real estate attorney about your situation.
          </p>

          <div
            className="prose prose-lg mt-8 max-w-none prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-a:font-medium prose-a:text-forest prose-a:underline-offset-2 prose-strong:text-ink prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: guide.html }}
          />
        </article>
      </Container>

      {buyerGuide && guide.vendorCategories.length > 0 && (
        <section aria-labelledby="guide-pros" className="bg-surface">
          <Container className="py-12 sm:py-16">
            <h2 id="guide-pros" className="text-3xl font-bold tracking-tight">
              Local pros for this step
            </h2>
            <div className="mt-2 max-w-2xl">
              <VendorModuleNote />
            </div>
            <div className="mt-8 space-y-12">
              {guide.vendorCategories.map((category) => (
                <VendorModule key={category} market={market} category={category} vendors={fairVendorOrder((vendors ?? []).filter((v) => v.category === category), category)} source="buyer_guide" />
              ))}
            </div>
          </Container>
        </section>
      )}

      {!buyerGuide && vendorSections.length > 0 && (
        <section aria-labelledby="guide-pros" className="bg-surface">
          <Container className="py-12 sm:py-16">
            <h2 id="guide-pros" className="text-3xl font-bold tracking-tight">
              Local pros for this step
            </h2>
            <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
              Independent businesses you contact and hire directly. Verified vendors are listed first.
            </p>
            <div className="mt-8 space-y-12">
              {vendorSections.map((section) => (
                <div key={section.info.value}>
                  <div className="flex items-end justify-between gap-4">
                    <h3 className="text-xl font-semibold tracking-tight">{section.info.label}</h3>
                    <Link href={`/vendors/${section.info.slug}`} className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
                      See all
                    </Link>
                  </div>
                  <div className="mt-5">
                    <CardGrid>
                      {section.vendors.map((vendor) => (
                        <VendorCard key={vendor.id} market={market} vendor={vendor} />
                      ))}
                    </CardGrid>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <Container className="py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          {!buyerGuide && vendorSections.length === 0 && browseCategories.length > 0 && (
            <p className="text-[15px] leading-relaxed text-muted">
              Looking for help? Browse{" "}
              {browseCategories.map((c, i) => (
                <span key={c}>
                  {i > 0 && (i === browseCategories.length - 1 ? " and " : ", ")}
                  <Link href={`/vendors/${categoryByValue(c).slug}`} className="font-medium text-forest underline underline-offset-2">
                    {categoryByValue(c).label.toLowerCase()}
                  </Link>
                </span>
              ))}{" "}
              in our vendor directory.
            </p>
          )}

          {otherGuides.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight">More guides</h2>
              <ul className="mt-3 space-y-2">
                {otherGuides.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/guides/${g.slug}`} className="text-[17px] font-medium text-forest underline-offset-2 hover:underline">
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {buyerGuide ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withSource("/buy/calculator", "buyer_guide")}>Estimate your costs</ButtonLink>
              <ButtonLink href={withSource("/buy/checklist", "buyer_guide")} variant="secondary">
                Buyer checklist
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sell">List your home</ButtonLink>
              <ButtonLink href="/sell/checklist" variant="secondary">
                Pre-sale checklist
              </ButtonLink>
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
