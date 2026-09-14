import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";
import { vendorCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Vetted Nashville real estate vendors",
  description:
    "Find Nashville real estate attorneys, home inspectors, photographers, painters, handymen, and lenders. Contact them directly through Nashville Buys.",
  alternates: { canonical: "/vendors" },
};

export default function VendorsPage() {
  return (
    <>
      <PageHeader
        title="Vetted Nashville vendors"
        intro="Independent professionals for buying and selling direct. Each one certifies they are licensed and insured, and you contract with them yourself."
      />
      <Container>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendorCategories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/vendors/${category.slug}`}
                className="flex min-h-24 items-center justify-between rounded-2xl border border-line bg-white px-6 text-xl font-semibold tracking-tight transition-colors hover:border-forest hover:text-forest"
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
    </>
  );
}
