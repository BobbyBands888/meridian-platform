import type { Metadata } from "next";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sell your Nashville home by owner",
  description:
    "List your Nashville home for sale by owner on Nashville Buys. Free to list, buyers contact you directly, and you hire your own attorney and inspector.",
  alternates: { canonical: "/sell" },
};

const points = [
  "Free to list",
  "Buyers contact you directly",
  "Reviewed before it goes live",
  "Up to 20 photos",
];

export default function SellPage() {
  return (
    <>
      <PageHeader
        title="Sell your Nashville home, direct."
        intro="List your home free and hear from buyers yourself. You stay in charge of pricing, showings, and who you hire to close."
      >
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p}>
              <Check label={p} />
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <ButtonLink href="/sign-in?next=/sell">Sign in to list your home</ButtonLink>
        </div>
      </PageHeader>
      <Container>
        <div className="max-w-2xl rounded-2xl border border-line p-6 text-[15px] leading-relaxed text-muted sm:p-8">
          <h2 className="text-lg font-semibold text-ink">Before you list</h2>
          <p className="mt-2">
            Tennessee requires sellers to give buyers a Residential Property Condition Disclosure. Nashville Buys does not
            give legal or pricing advice, so we recommend hiring a real estate attorney to review your contract and
            closing.
          </p>
        </div>
      </Container>
    </>
  );
}
