import { PhotoCard } from "@/components/photo-card";
import { ButtonLink } from "@/components/ui";
import { withSource, type PageSource } from "@/lib/attribution";
import type { PublicVendor } from "@/lib/database.types";
import type { Market } from "@/lib/markets";
import { verifiedBadgeText } from "@/lib/verification";
import { categoryByValue, firstSentence, vendorPath } from "@/lib/vendors";

type Props = {
  market: Pick<Market, "name" | "timezone">;
  vendor: PublicVendor;
  priority?: boolean;
  /** Page source for leads sent from the profile this card links to (?s=). */
  source?: PageSource;
};

export function VendorCard({ market, vendor, priority, source }: Props) {
  const href = withSource(vendorPath(vendor), source);
  return (
    <PhotoCard
      href={href}
      imageUrl={vendor.headshot_url}
      imageAlt={`${vendor.business_name} headshot`}
      imagePosition="top"
      priority={priority}
      eyebrow={categoryByValue(vendor.category).singular}
      title={vendor.business_name}
      subtitle={firstSentence(vendor.bio)}
      meta={
        <dl className="mt-1 space-y-0.5 text-[15px]">
          <div className="flex gap-1.5">
            <dt className="text-muted">Serves</dt>
            <dd>{vendor.service_area}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Pricing</dt>
            <dd>{vendor.price_range}</dd>
          </div>
        </dl>
      }
      checks={[
        vendor.verified_at ? verifiedBadgeText(market, vendor.verified_at) : "Licensed and insured, self-certified",
        ...(vendor.founding_vendor ? ["Founding vendor"] : []),
      ]}
      action={
        <ButtonLink href={withSource(`${vendorPath(vendor)}#contact`, source)} variant="secondary" className="sm:w-full" aria-label={`Contact ${vendor.business_name}`}>
          Contact
        </ButtonLink>
      }
    />
  );
}
