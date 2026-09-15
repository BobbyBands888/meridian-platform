import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { zipGroups } from "@/lib/areas";
import { getCurrentProfile, getCurrentUser, isProfileComplete } from "@/lib/auth";
import { getDisclosureGuidePath } from "@/lib/guides";
import { requireMarket } from "@/lib/market-data";
import { brandName, countyList } from "@/lib/markets";
import { createListing } from "./actions";
import { ListingForm } from "./listing-form";

export async function generateMetadata({ params }: PageProps<"/[market]/sell">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  return {
    title: `Sell your ${market.name} home by owner`,
    description: `List your home for sale by owner in ${market.name} and across ${market.region}. Free to list, and buyers contact you directly.`,
    alternates: { canonical: "/sell" },
  };
}

const points = ["Free to list", "Buyers contact you directly", "Reviewed before it goes live", "Up to 20 photos"];

function ChecklistLink() {
  return (
    <p className="mt-6 text-[15px]">
      Not ready to list yet?{" "}
      <Link href="/sell/checklist" className="font-medium text-forest underline underline-offset-2">
        Use the pre-sale checklist
      </Link>
      .
    </p>
  );
}

export default async function SellPage({ params }: PageProps<"/[market]/sell">) {
  const market = await requireMarket((await params).market);
  const user = await getCurrentUser();
  if (user && !isProfileComplete(await getCurrentProfile())) redirect("/welcome?next=/sell");

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Sell your {market.name} home, direct.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          List your home free and hear from buyers yourself, anywhere in {countyList(market, "or")}. You stay in charge of pricing,
          showings, and who you hire to close.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p}>
              <Check label={p} />
            </li>
          ))}
        </ul>
        <ChecklistLink />

        {user ? (
          <div className="mt-10">
            <ListingForm
              mode="create"
              zipGroups={zipGroups(market)}
              disclosureNote={market.disclosure_note}
              disclosureGuidePath={await getDisclosureGuidePath(market.slug)}
              userId={user.id}
              action={createListing}
              submitLabel="Submit listing for review"
              initial={{ street: "", zip: "", hide_exact_address: false, price: "", beds: "", baths: "", sqft: "", description: "", photo_urls: [] }}
            />
            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              {brandName(market)} is not a broker and doesn&apos;t give pricing or legal advice. We recommend a real estate attorney
              for your contract and closing.
            </p>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-line p-6">
            <h2 className="text-xl font-semibold tracking-tight">Sign in to list your home</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We&apos;ll email you a sign-in link. Then add your address, details, and photos. We review every listing, usually
              within 24 hours.
            </p>
            <ButtonLink href="/sign-in?next=/sell" className="mt-5">
              Sign in to list your home
            </ButtonLink>
          </div>
        )}
      </div>
    </Container>
  );
}
