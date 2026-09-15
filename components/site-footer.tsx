import Link from "next/link";
import { COMPANY, isLive, type Market } from "@/lib/markets";

export function SiteFooter({ market }: { market: Market }) {
  const links = [
    { href: "/about", label: "About" },
    { href: "/legal", label: "Legal" },
    { href: "/legal#privacy", label: "Privacy" },
    { href: "/legal#fair-housing", label: "Fair Housing" },
    ...(isLive(market) ? [{ href: "/guides", label: "Guides" }] : []),
  ];

  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted">
          <p>
            © 2026 {COMPANY.name} · {market.name}, {market.state_code} ·{" "}
            <a href={`mailto:${market.sender_email}`} className="hover:text-ink">
              {market.sender_email}
            </a>
          </p>
          <p className="mt-1">{COMPANY.mailingAddress}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
