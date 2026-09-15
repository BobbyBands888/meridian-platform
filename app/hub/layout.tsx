import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, hubUrl } from "@/lib/markets";

export const metadata: Metadata = {
  metadataBase: new URL(hubUrl()),
  title: { default: `${COMPANY.name} · For-sale-by-owner marketplaces`, template: `%s · ${COMPANY.name}` },
  description: `${COMPANY.name} runs free for-sale-by-owner listing hubs with vetted local vendor directories, one city at a time.`,
  openGraph: { type: "website", siteName: COMPANY.name, locale: "en_US" },
};

// getownvista.com: the company page listing every market. It has no accounts, listings, or vendors of its own.
export default function HubLayout({ children }: LayoutProps<"/hub">) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-forest">
            {COMPANY.name}
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm leading-relaxed text-muted sm:px-6">
          <p>
            © 2026 {COMPANY.name}. Our marketplaces connect buyers, sellers, and professionals directly. We are not a broker, do not
            hold funds, and do not facilitate closings.
          </p>
          <p className="mt-1">{COMPANY.mailingAddress}</p>
        </div>
      </footer>
    </>
  );
}
