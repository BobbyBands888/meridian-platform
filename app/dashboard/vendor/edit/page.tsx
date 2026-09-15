import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateVendorProfile } from "@/app/vendors/join/actions";
import { VendorForm } from "@/app/vendors/join/vendor-form";

export const metadata: Metadata = {
  title: "Edit vendor profile",
  robots: { index: false },
};

export default async function EditVendorPage() {
  const profile = await requireProfile("/dashboard/vendor/edit");
  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*").eq("profile_id", profile.id).maybeSingle();
  if (!vendor) redirect("/vendors/join");
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
        {vendor.status === "approved" && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Changes to your business name, bio, or headshot are reviewed before they go live. Your current profile stays up
            in the meantime. Service area, pricing, website, and category update right away.
          </p>
        )}
        {vendor.status === "rejected" && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Saving will resubmit your profile for review.</p>
        )}
        <div className="mt-8">
          <VendorForm
            mode="edit"
            userId={profile.id}
            action={updateVendorProfile}
            submitLabel={vendor.status === "rejected" ? "Save and resubmit" : "Save changes"}
            initial={{
              business_name: reviewed.business_name,
              category: vendor.category,
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
