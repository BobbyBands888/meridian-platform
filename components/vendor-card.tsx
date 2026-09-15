import { PhotoCard } from "@/components/photo-card";
import { ButtonLink } from "@/components/ui";
import type { PublicVendor } from "@/lib/database.types";
import { categoryByValue, firstSentence, vendorPath } from "@/lib/vendors";

export function VendorCard({ vendor, priority }: { vendor: PublicVendor; priority?: boolean }) {
  const href = vendorPath(vendor);
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
      checks={vendor.founding_vendor ? ["Licensed and insured, self-certified", "Founding vendor"] : ["Licensed and insured, self-certified"]}
      action={
        <ButtonLink href={`${href}#contact`} variant="secondary" className="sm:w-full" aria-label={`Contact ${vendor.business_name}`}>
          Contact
        </ButtonLink>
      }
    />
  );
}
