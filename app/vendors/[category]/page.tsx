import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { vendorCategories } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return vendorCategories.map((c) => ({ category: c.slug }));
}

function findCategory(slug: string) {
  return vendorCategories.find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/vendors/[category]">): Promise<Metadata> {
  const category = findCategory((await params).category);
  if (!category) return {};
  return {
    title: `${category.label} in Nashville, TN`,
    description: `Nashville ${category.label.toLowerCase()} for home buyers and FSBO sellers. Contact them directly through Nashville Buys.`,
    alternates: { canonical: `/vendors/${category.slug}` },
  };
}

export default async function VendorCategoryPage({ params }: PageProps<"/vendors/[category]">) {
  const category = findCategory((await params).category);
  if (!category) notFound();

  return (
    <>
      <PageHeader title={`${category.label} in Nashville`} />
      <Container>
        <EmptyState
          title={`No ${category.label.toLowerCase()} listed yet`}
          actions={
            <ButtonLink href="/vendors" variant="secondary">
              All vendor categories
            </ButtonLink>
          }
        >
          We&apos;re approving our first founding vendors now.
        </EmptyState>
      </Container>
    </>
  );
}
