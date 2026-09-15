import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { getCurrentProfile, getCurrentUser, isProfileComplete } from "@/lib/auth";
import { requireMarket } from "@/lib/market-data";
import { brandName, countyList, isLive } from "@/lib/markets";
import { VENDOR_CATEGORY_LIMIT_NOTE } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { joinVendorDirectory } from "./actions";
import { VendorForm } from "./vendor-form";

export async function generateMetadata({ params }: PageProps<"/[market]/vendors/join">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  const brand = brandName(market);
  return {
    title: isLive(market) ? "Join the vendor directory" : "Pre-register as a founding vendor",
    description: `${market.name} attorneys, home inspectors, photographers, painters, handymen, and lenders: join the ${brand} vendor directory and hear from local buyers and FSBO sellers.`,
    alternates: { canonical: "/vendors/join" },
  };
}

export default async function JoinPage({ params }: PageProps<"/[market]/vendors/join">) {
  const market = await requireMarket((await params).market);
  const live = isLive(market);
  const brand = brandName(market);
  const user = await getCurrentUser();

  if (user) {
    const profile = await getCurrentProfile();
    if (!isProfileComplete(profile)) redirect("/welcome?next=/vendors/join");
    const supabase = await createClient();
    const { data: vendor } = await supabase.from("vendors").select("id").eq("profile_id", user.id).maybeSingle();
    if (vendor) redirect("/dashboard/vendor");
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          {live ? "Join the vendor directory" : "Pre-register as a founding vendor"}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {live
            ? `Get found by ${market.name} buyers and for-sale-by-owner sellers who need a pro. Inquiries come to you by email, and you work with clients under your own agreements.`
            : `${brand} is launching soon. Create your profile now, and we'll list you in the directory the day we open. Inquiries come to you by email, and you work with clients under your own agreements.`}
        </p>
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <Check label="Founding vendor" />
          <p className="mt-2 text-[15px] leading-relaxed">
            Free for founding vendors during our {market.name} launch. When we introduce pricing, founding vendors get first notice
            and a locked-in rate.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">{VENDOR_CATEGORY_LIMIT_NOTE}</p>
        </div>

        {user ? (
          <div className="mt-10">
            <VendorForm
              mode="join"
              brand={brand}
              serviceAreaExample={countyList({ counties: market.counties.slice(0, 2) })}
              userId={user.id}
              action={joinVendorDirectory}
              submitLabel={live ? "Submit for review" : "Pre-register for launch"}
              initial={{ business_name: "", category: "", headshot_url: "", bio: "", service_area: "", price_range: "", website: "", certifications: [] }}
            />
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-line p-6">
            <h2 className="text-xl font-semibold tracking-tight">Sign in to get started</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We&apos;ll email you a sign-in link. Then add your business details, a headshot, and confirm five quick
              certifications. {live ? "We review every profile, usually within 24 hours." : "We review every profile before launch."}
            </p>
            <ButtonLink href="/sign-in?next=/vendors/join" className="mt-5">
              Sign in to join
            </ButtonLink>
          </div>
        )}
      </div>
    </Container>
  );
}
