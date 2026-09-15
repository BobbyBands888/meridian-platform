import type { Metadata } from "next";
import { Check } from "@/components/photo-card";
import { ButtonLink, Container } from "@/components/ui";
import { alertAreaLabel, isAlertToken } from "@/lib/listing-alerts";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitButton } from "@/components/submit-button";
import { unsubscribeFromAlerts } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe from listing alerts",
  robots: { index: false, follow: false },
  // The token in the address is the only key to this page; don't pass it on to other sites.
  referrer: "no-referrer",
};

// Opening the link only shows a button. Mail scanners fetch links in emails, so a plain visit must never unsubscribe.
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[market]/alerts/unsubscribe">) {
  const market = await requireMarket((await params).market);
  const { token, error } = await searchParams;
  const alert = isAlertToken(token)
    ? (await createAdminClient().from("listing_alerts").select("email, zip, unsubscribed_at, market_id").eq("unsubscribe_token", token).maybeSingle()).data
    : null;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg">
        {!alert ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This unsubscribe link isn&apos;t valid</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              It may be incomplete. Open the link from your most recent {brandName(market)} listing alert email, or write to us and
              we&apos;ll remove you.
            </p>
            <ButtonLink href={`mailto:${market.sender_email}?subject=Unsubscribe%20from%20listing%20alerts`} variant="secondary" className="mt-8">
              Email {market.sender_email}
            </ButtonLink>
          </>
        ) : alert.unsubscribed_at ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">You&apos;re unsubscribed</h1>
            <div role="status" className="mt-6">
              <Check label="No more listing alerts" />
              <p className="mt-2 break-words text-[17px] leading-relaxed text-muted">
                We won&apos;t send listing alerts to {alert.email}. Changed your mind? Sign up again anytime on the home page.
              </p>
            </div>
            <ButtonLink href="/homes" variant="secondary" className="mt-8">
              Browse homes
            </ButtonLink>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Unsubscribe from listing alerts?</h1>
            <p className="mt-4 break-words text-[17px] leading-relaxed text-muted">
              We&apos;ll stop emailing {alert.email} about new homes
              {alert.zip ? ` in ${alertAreaLabel(market, alert.zip)}` : ""}.
            </p>
            {error && (
              <p role="alert" className="mt-4 text-[15px] text-red-700">
                Something went wrong. Please try again.
              </p>
            )}
            <form action={unsubscribeFromAlerts} className="mt-8">
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
