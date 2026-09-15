import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Check } from "@/components/photo-card";
import { Container } from "@/components/ui";
import { getPublicVendor } from "@/lib/public-vendors";
import { site } from "@/lib/site";
import { verifiedBadgeText } from "@/lib/verification";
import { categoryByValue, vendorPath } from "@/lib/vendors";

export const revalidate = 300;
export const dynamicParams = true;

// Profiles render on first request and are then cached (ISR).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/vendors/[category]/[id]">): Promise<Metadata> {
  const vendor = await getPublicVendor((await params).id);
  if (!vendor) return {};
  const category = categoryByValue(vendor.category);
  const title = `${vendor.business_name}, ${category.singular} in Nashville`;
  const description = vendor.bio.length > 155 ? `${vendor.bio.slice(0, 152).trimEnd()}…` : vendor.bio;
  const images = [{ url: vendor.headshot_url, alt: `${vendor.business_name} headshot` }];
  return {
    title,
    description,
    alternates: { canonical: vendorPath(vendor) },
    openGraph: { type: "profile", title, description, url: vendorPath(vendor), siteName: site.name, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function VendorProfilePage({ params }: PageProps<"/vendors/[category]/[id]">) {
  const vendor = await getPublicVendor((await params).id);
  if (!vendor) notFound(); // The layout already 404s; this narrows the type.

  const category = categoryByValue(vendor.category);

  const websiteHost = vendor.website ? new URL(vendor.website).hostname.replace(/^www\./, "") : null;

  return (
    <Container className="py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link href="/vendors" className="hover:text-ink">
          Vendors
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/vendors/${category.slug}`} className="hover:text-ink">
          {category.label}
        </Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <article>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-surface sm:aspect-square sm:w-48">
              <Image
                src={vendor.headshot_url}
                alt={`${vendor.business_name} headshot`}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 640px) 192px, 100vw"
                className="object-cover object-top"
              />
            </div>
            <div>
              <p className="text-[15px] font-medium text-forest">{category.singular}</p>
              <h1 className="mt-1 text-4xl font-bold leading-[1.1] tracking-tight">{vendor.business_name}</h1>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                <li>
                  <Check label={vendor.verified_at ? verifiedBadgeText(vendor.verified_at) : "Licensed and insured, self-certified"} />
                </li>
                {vendor.founding_vendor && (
                  <li>
                    <Check label="Founding vendor" />
                  </li>
                )}
              </ul>
            </div>
          </div>

          <h2 className="sr-only">About</h2>
          <p className="mt-8 whitespace-pre-line text-[18px] leading-[1.75]">{vendor.bio}</p>

          <dl className="mt-8 grid gap-4 border-t border-line pt-6 text-[16px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">Service area</dt>
              <dd className="mt-0.5">{vendor.service_area}</dd>
            </div>
            <div>
              <dt className="text-muted">Starting price range</dt>
              <dd className="mt-0.5">{vendor.price_range}</dd>
            </div>
            {vendor.website && websiteHost && (
              <div>
                <dt className="text-muted">Website</dt>
                <dd className="mt-0.5">
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium text-forest underline underline-offset-2">
                    {websiteHost}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-8 rounded-xl bg-surface p-4 text-[14px] leading-relaxed text-muted">
            Vendors are independent businesses.{" "}
            {vendor.verified_at
              ? "A reviewed-documents badge means we looked at their license and insurance documents on that date; it isn't a guarantee of quality or current standing."
              : "Nashville Buys hasn't reviewed this vendor's license or insurance documents."}{" "}
            We don&apos;t endorse any vendor and aren&apos;t a party to your agreement. Confirm credentials before you hire.
          </p>
        </article>

        <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line p-6">
            <h2 id="contact-heading" className="text-2xl font-semibold tracking-tight">
              Contact {vendor.business_name}
            </h2>
            <p className="mb-6 mt-2 text-[15px] text-muted">They&apos;ll reply to you by email.</p>
            <ContactForm type="vendor" targetId={vendor.id} recipientLabel={vendor.business_name} />
          </div>
        </section>
      </div>
    </Container>
  );
}
