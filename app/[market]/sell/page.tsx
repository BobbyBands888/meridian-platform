import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "@/components/photo-card";
import { Container } from "@/components/ui";
import { FocusZipLink, ZipChecker } from "@/components/zip-field";
import { zipDirectory } from "@/lib/areas";
import { getCurrentProfile, getCurrentUser, isProfileComplete } from "@/lib/auth";
import { getDisclosureGuidePath } from "@/lib/guides";
import { requireMarket } from "@/lib/market-data";
import { DRAFT_PHOTO_MAX, draftFormValues, getCookieDraft } from "@/lib/listing-drafts";
import { LISTING_PHOTO_MAX } from "@/lib/listings";
import { brandName, countyList, serviceArea, type Market } from "@/lib/markets";
import { createListing } from "./actions";
import { ContactStep } from "./contact-step";
import { forgetDraft, saveDraft, submitDraft } from "./draft-actions";
import { DraftSubmitted } from "./draft-submitted";
import { ListingForm } from "./listing-form";

export async function generateMetadata({ params }: PageProps<"/[market]/sell">): Promise<Metadata> {
  const market = await requireMarket((await params).market);
  return {
    title: `Sell your ${market.name} home by owner`,
    description: `List your home for sale by owner across ${serviceArea(market, `${market.name} and ${market.region}`)}. Free to list, and buyers contact you directly.`,
    alternates: { canonical: "/sell" },
  };
}

const points = ["Free to list", "Buyers contact you directly", "Reviewed before it goes live"];

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

export default async function SellPage({ params, searchParams }: PageProps<"/[market]/sell">) {
  const market = await requireMarket((await params).market);
  const query = await searchParams;
  const user = await getCurrentUser();
  if (user && !isProfileComplete(await getCurrentProfile())) redirect("/welcome?next=/sell");

  // Signed out: the seller's draft on this device, if they've started one.
  const draft = user ? null : await getCookieDraft(market);
  const sParam = typeof query.s === "string" && /^[a-z0-9_-]{1,60}$/i.test(query.s) ? query.s.toLowerCase() : null;
  const source = draft?.source ?? sParam;
  const directory = zipDirectory(market);

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Sell your {market.name} home, direct.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          List your home free and hear from buyers yourself, anywhere in {serviceArea(market, countyList(market, "or"))}. You stay in charge of pricing,
          showings, and who you hire to close.
        </p>
        {draft?.status !== "pending_verification" && (
          <p className="mt-3 text-[15px]">
            Not sure if we serve your area? <FocusZipLink targetId="zip">Check your ZIP</FocusZipLink>
          </p>
        )}
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {[...points, `Up to ${LISTING_PHOTO_MAX} photos`].map((p) => (
            <li key={p}>
              <Check label={p} />
            </li>
          ))}
        </ul>
        <ChecklistLink />

        {query.draft === "unavailable" && (
          <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-[15px] text-red-900">
            That confirmation link doesn&apos;t match a listing waiting for this email. If you started a listing with another address,
            open the link sent there.
          </p>
        )}

        <div className="mt-10">
          {user ? (
            <>
              <ListingForm
                mode="create"
                source={sParam}
                zipDirectory={directory}
                sellerEmail={user.email}
                disclosureNote={market.disclosure_note}
                disclosureGuidePath={await getDisclosureGuidePath(market.slug)}
                userId={user.id}
                action={createListing}
                submitLabel="Submit listing for review"
                draftId={crypto.randomUUID()}
                initial={{ street: "", zip: "", hide_exact_address: false, price: "", beds: "", baths: "", sqft: "", description: "", photo_urls: [] }}
              />
              <Disclaimer market={market} />
            </>
          ) : draft?.status === "pending_verification" ? (
            <DraftSubmitted email={draft.email} />
          ) : draft?.status === "draft" ? (
            <>
              <ListingForm
                mode="create"
                source={source}
                draft={{
                  email: draft.email,
                  step: draft.step,
                  photoMax: DRAFT_PHOTO_MAX,
                  save: saveDraft,
                  uploadTargetUrl: "/sell/photo-upload-target",
                  startOver: forgetDraft,
                }}
                zipDirectory={directory}
                sellerEmail={draft.email}
                disclosureNote={market.disclosure_note}
                disclosureGuidePath={await getDisclosureGuidePath(market.slug)}
                userId={draft.id}
                action={submitDraft}
                submitLabel="Submit listing"
                draftId={draft.id}
                initial={draftFormValues(draft)}
              />
              <Disclaimer market={market} />
            </>
          ) : (
            <>
              <ContactStep source={sParam} />
              <div className="mt-6">
                <ZipChecker id="zip" directory={directory} source="/sell" />
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

function Disclaimer({ market }: { market: Market }) {
  return (
    <p className="mt-6 text-[13px] leading-relaxed text-muted">
      {brandName(market)} is not a broker and doesn&apos;t give pricing or legal advice. We recommend a real estate attorney for
      your contract and closing.
    </p>
  );
}
