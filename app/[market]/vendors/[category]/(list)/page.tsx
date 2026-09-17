import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/photo-card";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { VendorCard } from "@/components/vendor-card";
import { getMarket, requireMarket } from "@/lib/market-data";
import { brandName, isLive } from "@/lib/markets";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { VENDOR_CATEGORY_LIMIT_NOTE, vendorCategories } from "@/lib/site";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { fairVendorOrder } from "@/lib/vendor-order";
import { categoryBySlug } from "@/lib/vendors";

export const revalidate = 300;
// Must stay true: with false, on-demand revalidation of these prerendered pages 404s (NoFallbackError).
// Unknown categories still 404 via the [category] layout.
export const dynamicParams = true;

const ALL = { slug: "all", label: "All Vendors" } as const;

// Prerendered per live market (the [market] layout supplies the market); coming-soon markets have no directory yet.
export async function generateStaticParams({ params }: { params: { market: string } }) {
  const market = await getMarket(params.market);
  if (!market || !isLive(market)) return [];
  return [...vendorCategories.map((c) => ({ category: c.slug })), { category: ALL.slug }];
}

export async function generateMetadata({ params }: PageProps<"/[market]/vendors/[category]">): Promise<Metadata> {
  const { market: marketSlug, category: slug } = await params;
  const market = await requireMarket(marketSlug);
  if (slug === ALL.slug) {
    const anyVendors = (await getActiveVendorCategories(market.id)).length > 0;
    return {
      robots: anyVendors ? undefined : { index: false },
      title: `All ${market.name} real estate vendors`,
      description: `Every approved vendor on ${brandName(market)}: attorneys, inspectors, photographers, painters, handymen, and lenders.`,
      alternates: { canonical: "/vendors/all" },
    };
  }
  const category = categoryBySlug(slug);
  if (!category) return {};
  const active = await getActiveVendorCategories(market.id);
  return {
    title: `${category.label} in ${market.name}, ${market.state_code}`,
    description: `${market.name} ${category.label.toLowerCase()} for home buyers and FSBO sellers. Contact them directly through ${brandName(market)}.`,
    alternates: { canonical: `/vendors/${category.slug}` },
    // Empty categories stay reachable by URL but are kept out of search results and navigation.
    robots: active.some((c) => c.slug === category.slug) ? undefined : { index: false },
  };
}

function chipOrder(slug: string) {
  return slug === ALL.slug ? -1 : vendorCategories.findIndex((c) => c.slug === slug);
}

export default async function VendorCategoryPage({ params }: PageProps<"/[market]/vendors/[category]">) {
  const { market: marketSlug, category: slug } = await params;
  const market = await requireMarket(marketSlug);
  const category = slug === ALL.slug ? null : categoryBySlug(slug);
  if (slug !== ALL.slug && !category) notFound(); // The layout already 404s; this narrows the type.

  const supabase = createPublicClient({ tags: [CACHE_TAGS.vendors] });
  let query = supabase.from("public_vendors").select("*").eq("market_id", market.id);
  if (category) query = query.eq("category", category.value);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load vendors: ${error.message}`);
  // Verified vendors first, rotating daily within each group (lib/vendor-order.ts).
  const vendors = fairVendorOrder(data, slug);

  const label = category?.label ?? ALL.label;
  const activeCategories = await getActiveVendorCategories(market.id);
  const chips = [ALL, ...activeCategories.filter((c) => c.slug !== slug), ...(category ? [category] : [])].sort(
    (a, b) => chipOrder(a.slug) - chipOrder(b.slug),
  );

  return (
    <>
      <PageHeader title={category ? `${label} in ${market.name}` : `All ${market.name} vendors`}>
        <nav aria-label="Vendor categories" className="mt-6 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-2 whitespace-nowrap">
            {chips.map((c) => {
              const active = c.slug === slug;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/vendors/${c.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[15px] font-medium ${active ? "border-forest bg-forest text-white" : "border-line hover:border-forest hover:text-forest"}`}
                  >
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </PageHeader>
      <Container>
        {vendors.length > 0 ? (
          <CardGrid>
            {vendors.map((vendor, i) => (
              <VendorCard key={vendor.id} market={market} vendor={vendor} priority={i < 3} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title={category ? `No ${label.toLowerCase()} listed yet` : "No vendors listed yet"}
            actions={
              <>
                <ButtonLink href="/vendors/join">Join as a founding vendor</ButtonLink>
                <ButtonLink href="/guides" variant="secondary">
                  Read the guides
                </ButtonLink>
              </>
            }
          >
            We&apos;re approving our first founding vendors now. {VENDOR_CATEGORY_LIMIT_NOTE}
          </EmptyState>
        )}
      </Container>
    </>
  );
}
