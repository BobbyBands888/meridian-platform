import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { Container } from "@/components/ui";
import { getCurrentProfile, getCurrentUser, isProfileComplete, safeNextPath } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";
import { completeOnboarding } from "./actions";

export const metadata: Metadata = {
  title: "Finish setting up your account",
  robots: { index: false },
};

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const next = safeNextPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/welcome?next=${next}`)}`);

  const profile = await getCurrentProfile();
  if (profile && isProfileComplete(profile)) redirect(next);

  // Pre-select the role that matches where they were headed.
  const suggested: UserRole[] = next.startsWith("/sell") ? ["seller"] : next.startsWith("/vendors/join") ? ["vendor"] : [];

  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Nashville Buys</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          A few details to finish your account. Signed in as <span className="font-medium text-ink">{user.email}</span>.
        </p>
        <ProfileForm
          action={completeOnboarding}
          next={next}
          submitLabel="Continue"
          initial={{
            full_name: profile?.full_name ?? null,
            phone: profile?.phone ?? null,
            roles: profile?.roles?.length ? profile.roles : suggested,
          }}
        />
      </div>
    </Container>
  );
}
