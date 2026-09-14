import type { Metadata } from "next";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";

export const metadata: Metadata = {
  title: "Nashville homes for sale by owner",
  description:
    "Browse for-sale-by-owner homes in Nashville, TN. Contact sellers directly through Nashville Buys, with no agent in between.",
  alternates: { canonical: "/homes" },
};

export default async function HomesPage({ searchParams }: PageProps<"/homes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";

  return (
    <>
      <PageHeader title="Nashville homes for sale by owner" intro="Every home here is listed by its owner. Reach sellers directly.">
        <div className="mt-8">
          <SearchBar defaultValue={query} />
        </div>
      </PageHeader>
      <Container>
        <EmptyState
          title="No homes listed yet"
          actions={
            <>
              <ButtonLink href="/guides">Read the guides</ButtonLink>
              <ButtonLink href="/sell" variant="secondary">
                List your home
              </ButtonLink>
            </>
          }
        >
          Nashville Buys is just opening. While the first listings come in, our guides explain how buying and selling
          direct works in Tennessee.
        </EmptyState>
      </Container>
    </>
  );
}
