import Link from "next/link";
import { CardGrid } from "@/components/photo-card";
import { VendorCard } from "@/components/vendor-card";
import { withSource, type PageSource } from "@/lib/attribution";
import type { PublicVendor } from "@/lib/database.types";
import type { Market } from "@/lib/markets";
import type { ModuleCategory } from "@/lib/site";
import { categorySentenceName, moduleCategoryInfo } from "@/lib/vendors";

type Props = {
  market: Pick<Market, "name" | "timezone">;
  category: ModuleCategory;
  /** This category's approved vendors, already in fair order (lib/vendor-modules.ts). */
  vendors: PublicVendor[];
  /** Page source for leads from these cards. */
  source: PageSource;
  headingLevel?: "h2" | "h3";
  limit?: number;
};

/**
 * One vendor category on a buyer page: up to `limit` vendor cards, or an honest empty state. Never a blank box.
 * Order comes from lib/vendor-order.ts (verified first, rotating daily); nothing here depends on payment.
 */
export function VendorModule({ market, category, vendors, source, headingLevel = "h3", limit = 3 }: Props) {
  const info = moduleCategoryInfo(category);
  const Heading = headingLevel;
  const headingId = `pros-${category}`;
  const shown = vendors.slice(0, limit);
  const names = categorySentenceName(category);

  return (
    <section id={`vendors-${category}`} aria-labelledby={headingId} className="scroll-mt-24">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <Heading id={headingId} className="text-xl font-semibold tracking-tight">
          {info.label}
        </Heading>
        {shown.length > 0 && info.joinable && (
          <Link href={`/vendors/${info.slug}`} className="shrink-0 text-[15px] font-semibold text-forest hover:underline">
            See all {info.label.toLowerCase()}
          </Link>
        )}
      </div>
      {shown.length > 0 ? (
        <div className="mt-5">
          <CardGrid>
            {shown.map((vendor) => (
              <VendorCard key={vendor.id} market={market} vendor={vendor} source={source} />
            ))}
          </CardGrid>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-5">
          <p className="text-[15px] leading-relaxed">
            We&apos;re adding vetted {names.plural} in {market.name}.
          </p>
          {info.joinable && (
            <p className="mt-1 text-[14px] text-muted">
              Are you a local {names.singular}?{" "}
              <Link href={withSource(`/vendors/join?category=${category}`, "empty_module")} className="font-medium text-forest underline underline-offset-2">
                Join free
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** One line under a group of modules, so the order isn't mistaken for a ranking someone paid for. */
export function VendorModuleNote() {
  return (
    <p className="text-[14px] leading-relaxed text-muted">
      Independent businesses you contact and hire directly. Verified vendors are listed first, and the order rotates daily. No
      vendor pays for placement.
    </p>
  );
}
