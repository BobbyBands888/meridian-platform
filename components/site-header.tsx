"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { navLinks, site } from "@/lib/site";

// @supabase/ssr stores the session in readable sb-<ref>-auth-token cookies. Checking for one avoids shipping
// the Supabase client on every public page; account pages verify the session on the server.
const hasSessionCookie = () => /(?:^|;\s*)sb-[^=]+-auth-token(?:\.0)?=/.test(document.cookie);
const noopSubscribe = () => () => {};

export function SiteHeader() {
  const pathname = usePathname();
  // Re-read on every render; route changes re-render the header, which picks up sign-in and sign-out.
  const signedIn = useSyncExternalStore(noopSubscribe, hasSessionCookie, () => false);
  const account = signedIn ? { href: "/dashboard", label: "Account" } : { href: "/sign-in", label: "Sign in" };
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xl font-bold tracking-tight text-forest">{site.name}</span>
          {/* The location tag drops out on the narrowest phones so the name stays on one line. */}
          <span className="whitespace-nowrap rounded border max-[359px]:hidden border-line px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">
            Middle Tennessee
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`text-[15px] font-medium transition-colors hover:text-forest ${
                isActive(link.href) ? "text-forest" : "text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={account.href}
            className="rounded-lg border border-ink/15 px-4 py-2 text-[15px] font-medium transition-colors hover:border-forest hover:text-forest"
          >
            {account.label}
          </Link>
        </nav>

        <button
          type="button"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-white px-4 pb-4 md:hidden">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => setOpenOn(null)}
                  className="block border-b border-line py-4 text-lg font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={account.href}
            onClick={() => setOpenOn(null)}
            className="mt-4 block w-full rounded-lg border border-ink/15 py-3 text-center text-base font-medium"
          >
            {account.label}
          </Link>
        </nav>
      )}
    </header>
  );
}
