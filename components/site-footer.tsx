import Link from "next/link";
import { site } from "@/lib/site";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/legal", label: "Legal" },
  { href: "/legal#privacy", label: "Privacy" },
  { href: "/legal#fair-housing", label: "Fair Housing" },
  { href: "/guides", label: "Guides" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">
          © 2026 {site.company} · Nashville, TN ·{" "}
          <a href={`mailto:${site.email}`} className="hover:text-ink">
            {site.email}
          </a>
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {footerLinks.map((link) => (
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
