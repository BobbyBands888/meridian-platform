import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { updateProfile } from "@/app/[market]/welcome/actions";

export const metadata: Metadata = {
  title: "Edit your details",
  robots: { index: false },
};

export default async function EditProfilePage({ params }: PageProps<"/[market]/dashboard/profile">) {
  const market = await requireMarket((await params).market);
  const profile = await requireProfile("/dashboard/profile");

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/dashboard" className="text-[15px] font-medium text-forest hover:underline">
          ← Your account
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Edit your details</h1>
        <p className="mt-3 text-[15px] text-muted">
          Email: <span className="text-ink">{profile.email}</span>
        </p>
        <ProfileForm
          action={updateProfile}
          next="/dashboard"
          submitLabel="Save changes"
          brand={brandName(market)}
          initial={{ full_name: profile.full_name, phone: profile.phone, roles: profile.roles }}
        />
      </div>
    </Container>
  );
}
