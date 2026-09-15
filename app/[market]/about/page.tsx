import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";
import { requireMarket } from "@/lib/market-data";
import { brandName, COMPANY, isLive } from "@/lib/markets";

export async function generateMetadata({ params }: PageProps<"/[market]/about">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  return {
    title: "About",
    description: `Why ${brandName(market)} exists: one free place for ${market.region} owners to sell direct, buyers to reach them, and both to find local pros.`,
    alternates: { canonical: "/about" },
  };
}

// Placeholder copy (about 150 words) for the site owner to edit.
export default async function AboutPage({ params }: PageProps<"/[market]/about">) {
  const market = await requireMarket((await params).market);
  const brand = brandName(market);

  return (
    <Container className="py-12 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Why {brand} exists</h1>
        <div className="mt-8 space-y-5 text-[18px] leading-[1.75]">
          <p>Hi, I&apos;m Bobby.</p>
          <p>
            I started {brand} because selling a home yourself in {market.region} is harder to figure out than it should
            be. The information is scattered, the paperwork is unfamiliar, and it&apos;s hard to know which local pros to call.
          </p>
          <p>
            So we built one place for it. Owners list their homes free and hear from buyers directly. Buyers browse homes and
            reach owners without a middleman. A directory of local attorneys, inspectors, photographers, and other pros covers
            the steps in between, and our checklist and guides explain what {market.state} expects of sellers.
          </p>
          <p>
            We aren&apos;t a brokerage, and we don&apos;t take part in your sale. You set your price, choose your professionals,
            and sign your own agreements. Our job is to make the connections and keep the information clear.
          </p>
          <p>
            Have an idea for making this better? Email me at{" "}
            <a href={`mailto:${market.sender_email}`} className="font-medium text-forest underline underline-offset-2">
              {market.sender_email}
            </a>
            .
          </p>
          <p className="font-semibold">
            {brand} is an {COMPANY.name} company.
          </p>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {isLive(market) ? (
            <>
              <ButtonLink href="/homes">Browse homes</ButtonLink>
              <ButtonLink href="/sell" variant="secondary">
                List your home
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/">Get launch updates</ButtonLink>
          )}
        </div>
      </article>
    </Container>
  );
}
