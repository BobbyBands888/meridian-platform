import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatUsPhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

const roleLabels = { buyer: "Buyer", seller: "Seller", vendor: "Vendor" } as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await requireProfile("/dashboard");
  const saved = (await searchParams).saved === "1";

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] text-muted">Your account</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">Hi, {profile.full_name?.split(" ")[0]}</h1>
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="text-[15px] font-medium text-muted underline underline-offset-2 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>

      {saved && (
        <p role="status" className="mt-6">
          <Check label="Your details were saved." />
        </p>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="details-heading" className="rounded-2xl border border-line p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 id="details-heading" className="text-lg font-semibold tracking-tight">
              Your details
            </h2>
            <Link href="/dashboard/profile" className="text-[15px] font-medium text-forest hover:underline">
              Edit
            </Link>
          </div>
          <dl className="mt-4 space-y-3 text-[15px]">
            <div>
              <dt className="text-muted">Name</dt>
              <dd>{profile.full_name}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="break-all">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd>{formatUsPhone(profile.phone)}</dd>
            </div>
            <div>
              <dt className="text-muted">Using Nashville Buys as</dt>
              <dd>{profile.roles.map((r) => roleLabels[r]).join(", ") || "Not set"}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="next-heading" className="rounded-2xl border border-line p-6 lg:col-span-2">
          <h2 id="next-heading" className="text-lg font-semibold tracking-tight">
            Get started
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-surface p-5">
              <h3 className="font-semibold">Selling a home?</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">List it free and hear from buyers directly.</p>
              <ButtonLink href="/sell" className="mt-4">
                List your home
              </ButtonLink>
            </div>
            <div className="rounded-xl bg-surface p-5">
              <h3 className="font-semibold">{profile.roles.includes("vendor") ? "Your vendor profile" : "Offer professional services?"}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                {profile.roles.includes("vendor")
                  ? "Check your status and edit your directory profile."
                  : "Join the vendor directory. Free for founding vendors."}
              </p>
              <ButtonLink href={profile.roles.includes("vendor") ? "/dashboard/vendor" : "/vendors/join"} variant="secondary" className="mt-4">
                {profile.roles.includes("vendor") ? "Vendor dashboard" : "Join as a vendor"}
              </ButtonLink>
            </div>
            <div className="rounded-xl bg-surface p-5">
              <h3 className="font-semibold">Looking to buy?</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">Browse Nashville homes listed by their owners.</p>
              <ButtonLink href="/homes" variant="secondary" className="mt-4">
                Browse homes
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
    </Container>
  );
}
