import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function HubNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <p className="text-sm font-semibold text-forest">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">We couldn&apos;t find that page.</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-forest underline underline-offset-2">
        See all markets
      </Link>
    </Container>
  );
}
