import type { Metadata } from "next";
import { Check } from "@/components/photo-card";
import { SubmitButton } from "@/components/submit-button";
import { ButtonLink, Container } from "@/components/ui";
import { isCourseToken } from "@/lib/course";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeFromDraftReminders } from "./actions";

export const metadata: Metadata = {
  title: "Stop listing reminders",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Opening the link only shows a button. Mail scanners fetch links in emails, so a plain visit must never unsubscribe.
export default async function DraftUnsubscribePage({ params, searchParams }: PageProps<"/[market]/sell/resume/unsubscribe">) {
  const market = await requireMarket((await params).market);
  const { token, error } = await searchParams;
  const draft = isCourseToken(token)
    ? (await createAdminClient().from("listing_drafts").select("email, reminders_unsubscribed_at").eq("unsubscribe_token", token).maybeSingle()).data
    : null;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg">
        {!draft ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This unsubscribe link isn&apos;t valid</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Your draft may already have been deleted, which also stops its reminders. Write to us if you&apos;re still hearing from{" "}
              {brandName(market)}.
            </p>
            <ButtonLink href={`mailto:${market.sender_email}?subject=Unsubscribe`} variant="secondary" className="mt-8">
              Email {market.sender_email}
            </ButtonLink>
          </>
        ) : draft.reminders_unsubscribed_at ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">You&apos;re unsubscribed</h1>
            <div role="status" className="mt-6">
              <Check label="No more listing reminders" />
              <p className="mt-2 break-words text-[17px] leading-relaxed text-muted">
                We won&apos;t send {draft.email} reminders about this draft.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Stop reminders about your draft?</h1>
            <p className="mt-4 break-words text-[17px] leading-relaxed text-muted">We&apos;ll stop emailing {draft.email} about the listing you started.</p>
            {error && (
              <p role="alert" className="mt-4 text-[15px] text-red-700">
                Something went wrong. Please try again.
              </p>
            )}
            <form action={unsubscribeFromDraftReminders} className="mt-8">
              <input type="hidden" name="token" value={token as string} />
              <SubmitButton variant="forest" pendingLabel="Unsubscribing">
                Unsubscribe
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </Container>
  );
}
