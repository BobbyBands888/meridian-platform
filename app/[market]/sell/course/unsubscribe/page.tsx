import type { Metadata } from "next";
import { Check } from "@/components/photo-card";
import { SubmitButton } from "@/components/submit-button";
import { ButtonLink, Container } from "@/components/ui";
import { COURSE_DAYS, isCourseToken } from "@/lib/course";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeFromCourse } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe from the seller course",
  robots: { index: false, follow: false },
  // The token in the address is the only key to this page; don't pass it on to other sites.
  referrer: "no-referrer",
};

// Opening the link only shows a button. Mail scanners fetch links in emails, so a plain visit must never unsubscribe.
export default async function CourseUnsubscribePage({ params, searchParams }: PageProps<"/[market]/sell/course/unsubscribe">) {
  const market = await requireMarket((await params).market);
  const { token, error } = await searchParams;
  const signup = isCourseToken(token)
    ? (await createAdminClient().from("course_signups").select("email, next_day, unsubscribed_at").eq("unsubscribe_token", token).maybeSingle()).data
    : null;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg">
        {!signup ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This unsubscribe link isn&apos;t valid</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              It may be incomplete. Open the link from your most recent {brandName(market)} course email, or write to us and
              we&apos;ll remove you.
            </p>
            <ButtonLink href={`mailto:${market.sender_email}?subject=Unsubscribe%20from%20the%20seller%20course`} variant="secondary" className="mt-8">
              Email {market.sender_email}
            </ButtonLink>
          </>
        ) : signup.unsubscribed_at ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">You&apos;re unsubscribed</h1>
            <div role="status" className="mt-6">
              <Check label="No more course emails" />
              <p className="mt-2 break-words text-[17px] leading-relaxed text-muted">
                We won&apos;t send any more of the course to {signup.email}. The whole thing is on the checklist whenever you
                want it.
              </p>
            </div>
            <ButtonLink href="/sell/checklist" variant="secondary" className="mt-8">
              Open the checklist
            </ButtonLink>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Stop the seller course?</h1>
            <p className="mt-4 break-words text-[17px] leading-relaxed text-muted">
              We&apos;ll stop emailing {signup.email}. You&apos;re on day {Math.min(signup.next_day, COURSE_DAYS)} of {COURSE_DAYS}.
            </p>
            {error && (
              <p role="alert" className="mt-4 text-[15px] text-red-700">
                Something went wrong. Please try again.
              </p>
            )}
            <form action={unsubscribeFromCourse} className="mt-8">
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
