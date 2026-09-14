import type { Metadata } from "next";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Guides for buying and selling direct in Nashville",
  description:
    "Plain-language guides for Nashville home buyers and for-sale-by-owner sellers in Tennessee. General information only, not legal advice.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <PageHeader
        title="Guides"
        intro="Plain-language guides for buying and selling a home direct in Nashville. General information, not legal advice."
      />
      <Container>
        <EmptyState
          title="Our first guides are on the way"
          actions={
            <ButtonLink href="/legal" variant="secondary">
              Read our terms
            </ButtonLink>
          }
        >
          We&apos;re writing guides on selling without a realtor in Tennessee and on the state&apos;s property disclosure form.
        </EmptyState>
      </Container>
    </>
  );
}
