import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { formatGuideDate, getGuides } from "@/lib/guides";
import { requireMarket } from "@/lib/market-data";
import { serviceArea } from "@/lib/markets";

export async function generateMetadata({ params }: PageProps<"/[market]/guides">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  const guides = await getGuides(market.slug);
  return {
    title: `Guides for buying and selling direct in ${market.name}`,
    description: `Plain-language guides for ${serviceArea(market, `${market.name} and ${market.region}`)} home sellers and buyers, from selling without a realtor to ${market.state}'s disclosure rules. General information, not legal advice.`,
    alternates: { canonical: "/guides" },
    robots: guides.length > 0 ? undefined : { index: false },
  };
}

export default async function GuidesPage({ params }: PageProps<"/[market]/guides">) {
  const market = await requireMarket((await params).market);
  const guides = await getGuides(market.slug);

  return (
    <>
      <PageHeader
        title="Guides"
        intro={`Plain-language guides for buying and selling a home direct in ${serviceArea(market, `${market.name} and ${market.region}`)}. General information, not legal advice.`}
      />
      <Container>
        {guides.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-line p-6 transition-shadow hover:shadow-[0_8px_30px_rgba(17,17,17,0.08)] sm:p-7"
                >
                  <p className="text-[13px] font-medium text-forest">
                    {guide.readingMinutes} min read · {formatGuideDate(guide.updatedAt)}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold leading-snug tracking-tight group-hover:underline">{guide.title}</h2>
                  <p className="mt-3 flex-1 text-[16px] leading-relaxed text-muted">{guide.description}</p>
                  <span className="mt-5 text-[15px] font-semibold text-forest">Read the guide →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Our first guides are on the way" />
        )}

        <div className="mt-12 rounded-2xl bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Getting ready to sell?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Work through the pre-sale checklist, then list your home free.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/sell/checklist" variant="secondary">
              Pre-sale checklist
            </ButtonLink>
            <ButtonLink href="/sell">List your home</ButtonLink>
          </div>
        </div>
      </Container>
    </>
  );
}
