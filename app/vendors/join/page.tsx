import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { getCurrentProfile, getCurrentUser, isProfileComplete } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { joinVendorDirectory } from "./actions";
import { VendorForm } from "./vendor-form";

export const metadata: Metadata = {
  title: "Join the Nashville Buys vendor directory",
  description:
    "Nashville attorneys, home inspectors, photographers, painters, handymen, and lenders: join the Nashville Buys vendor directory and hear from local buyers and FSBO sellers.",
  alternates: { canonical: "/vendors/join" },
};

const FOUNDING_COPY =
  "Free for founding vendors during our Nashville launch. When we introduce pricing, founding vendors get first notice and a locked-in rate.";

export default async function JoinPage() {
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
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Join the vendor directory</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Get found by Nashville buyers and for-sale-by-owner sellers who need a pro. Inquiries come to you by email, and you
          work with clients under your own agreements.
        </p>
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <Check label="Founding vendor" />
          <p className="mt-2 text-[15px] leading-relaxed">{FOUNDING_COPY}</p>
        </div>

        {user ? (
          <div className="mt-10">
            <VendorForm
              mode="join"
              userId={user.id}
              action={joinVendorDirectory}
              submitLabel="Submit for review"
              initial={{ business_name: "", category: "", headshot_url: "", bio: "", service_area: "", price_range: "", website: "", certifications: [] }}
            />
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-line p-6">
            <h2 className="text-xl font-semibold tracking-tight">Sign in to get started</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We&apos;ll email you a sign-in link. Then add your business details, a headshot, and confirm five quick
              certifications. We review every profile, usually within 24 hours.
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
