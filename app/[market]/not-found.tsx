import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  description: "We couldn't find that page.",
  robots: { index: false },
};

// Shared by every market (not-found pages don't receive route params), so the copy stays market-neutral.
export default function NotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <p className="text-sm font-semibold text-forest">404</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        The listing may have sold or the link may be wrong. Head back home to search or start over.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </Container>
  );
}
