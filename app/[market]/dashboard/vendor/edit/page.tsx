import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { requireMarket } from "@/lib/market-data";
import { brandName, countyList, isLive } from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";
import { updateVendorProfile } from "@/app/[market]/vendors/join/actions";
import { VendorForm } from "@/app/[market]/vendors/join/vendor-form";

export const metadata: Metadata = {
  title: "Edit vendor profile",
  robots: { index: false },
};

export default async function EditVendorPage({ params }: PageProps<"/[market]/dashboard/vendor/edit">) {
  const market = await requireMarket((await params).market);
  const profile = await requireProfile("/dashboard/vendor/edit");
  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!vendor) redirect("/vendors/join");
  if (vendor.market_id !== market.id) redirect("/dashboard/vendor");
  const { data: pending } = await supabase.from("vendor_pending_edits").select("*").eq("vendor_id", vendor.id).maybeSingle();

  // Start from the proposed version when an edit is already waiting, so vendors keep refining it.
  const reviewed = pending ?? vendor;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Link href="/dashboard/vendor" className="text-[15px] font-medium text-forest hover:underline">
          ← Vendor dashboard
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Edit your profile</h1>
        {vendor.status === "approved" && isLive(market) && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Changes to your business name, category, bio, or headshot are reviewed before they go live. Your current profile
            stays up in the meantime. Service area, pricing, and website update right away.
          </p>
        )}
        {vendor.status === "rejected" && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Saving will resubmit your profile for review.</p>
        )}
        <div className="mt-8">
          <VendorForm
            mode="edit"
            brand={brandName(market)}
            state={market.state}
            serviceAreaExample={countyList({ counties: market.counties.slice(0, 2) })}
            userId={profile.id}
            action={updateVendorProfile}
            submitLabel={vendor.status === "rejected" ? "Save and resubmit" : "Save changes"}
            initial={{
              business_name: reviewed.business_name,
              category: reviewed.category,
              headshot_url: reviewed.headshot_url,
              bio: reviewed.bio,
              service_area: vendor.service_area,
              price_range: vendor.price_range,
              website: vendor.website ?? "",
              certifications: [],
            }}
          />
        </div>
      </div>
    </Container>
  );
}
