import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { CardGrid } from "@/components/photo-card";
import { SearchBar } from "@/components/search-bar";
import { ButtonLink, Container } from "@/components/ui";
import { getActiveListings } from "@/lib/public-listings";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { site } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const steps = [
  {
    title: "Sellers list free",
    body: "Post your home with photos and your asking price. We review each listing before it goes live.",
  },
  {
    title: "Buyers reach owners directly",
    body: "Send a message from any listing. It goes straight to the seller, with no agent in between.",
  },
  {
    title: "Everyone hires their own pros",
    body: "Find attorneys, inspectors, and lenders in our directory. You choose them and you sign with them.",
  },
];

export default async function HomePage() {
  const [vendorCategories, newestHomes] = await Promise.all([getActiveVendorCategories(), getActiveListings({}, 3)]);

  return (
    <>
      <section className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">{site.tagline}</h1>
          <div className="mt-8 sm:mt-10">
            <SearchBar />
          </div>
        </Container>
      </section>

      {newestHomes.length > 0 && (
        <section aria-labelledby="newest-heading">
          <Container className="pt-16 sm:pt-20">
            <div className="flex items-end justify-between gap-4">
              <h2 id="newest-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Newest homes
              </h2>
              <Link href="/homes" className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
                See all homes
              </Link>
            </div>
            <div className="mt-8">
              <CardGrid>
                {newestHomes.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </CardGrid>
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="how-heading">
        <Container className="py-16 sm:py-20">
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="text-sm font-semibold text-forest">Step {i + 1}</span>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {vendorCategories.length > 0 && (
        <section aria-labelledby="vendors-heading" className="bg-surface">
          <Container className="py-16 sm:py-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="vendors-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Local pros for every step
                </h2>
                <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">
                  Every vendor certifies they are licensed and insured before we approve their profile.
                </p>
              </div>
              <Link href="/vendors" className="text-[15px] font-semibold text-forest hover:underline">
                All vendors
              </Link>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {vendorCategories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/vendors/${category.slug}`}
                    className="flex min-h-20 items-center justify-between rounded-xl border border-line bg-white px-5 text-[17px] font-semibold transition-colors hover:border-forest hover:text-forest"
                  >
                    {category.label}
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section aria-labelledby="sell-heading">
        <Container className="py-16 sm:py-24">
          <div className="rounded-3xl bg-forest px-6 py-12 text-white sm:px-12 sm:py-16">
            <h2 id="sell-heading" className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Selling your Nashville home yourself?
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
              List it free and hear from buyers directly. Read our guides first so you know what Tennessee requires of sellers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sell">List your home</ButtonLink>
              <ButtonLink href="/guides" variant="secondary" className="border-white/30 bg-transparent text-white hover:border-white hover:text-white">
                Read the guides
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
