import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

// Only reached outside a market site (for example an unknown market). Market sites and the hub have their own 404s.
export default function GlobalNotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-4 py-24">
      <p className="text-sm font-semibold text-forest">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">We couldn&apos;t find that page.</h1>
      <Link href="/" className="mt-6 font-semibold text-forest underline underline-offset-2">
        Back to home
      </Link>
    </main>
  );
}
