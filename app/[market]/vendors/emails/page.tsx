import type { Metadata } from "next";
import { Check } from "@/components/photo-card";
import { SubmitButton } from "@/components/submit-button";
import { ButtonLink, Container } from "@/components/ui";
import { requireMarket } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVendorEmailToken } from "@/lib/vendor-email-prefs";
import { setVendorLifecycleEmails } from "./actions";

export const metadata: Metadata = {
  title: "Vendor email preferences",
  robots: { index: false, follow: false },
  // The token in the address is the only key to this page; don't pass it on to other sites.
  referrer: "no-referrer",
};

// Opening the link only shows the choice. Mail scanners fetch links in emails, so a plain visit changes nothing.
export default async function VendorEmailsPage({ params, searchParams }: PageProps<"/[market]/vendors/emails">) {
  const market = await requireMarket((await params).market);
  const { token, saved, error } = await searchParams;
  const vendor = isVendorEmailToken(token)
    ? (await createAdminClient().from("vendors").select("business_name, lifecycle_unsubscribed_at").eq("email_token", token).maybeSingle()).data
    : null;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg">
        {!vendor ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This link isn&apos;t valid</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              It may be incomplete. Use the link from your most recent vendor email, or write to us and we&apos;ll update your
              preferences.
            </p>
            <ButtonLink href={`mailto:${market.sender_email}?subject=Vendor%20email%20preferences`} variant="secondary" className="mt-8">
              Email {market.sender_email}
            </ButtonLink>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Vendor email preferences</h1>
            <p className="mt-4 break-words text-[17px] leading-relaxed text-muted">
              Tips and monthly inquiry summaries for <span className="font-medium text-ink">{vendor.business_name}</span>. Emails
              about your approval and every new inquiry always come through.
            </p>
            {saved && (
              <p role="status" className="mt-6">
                <Check label="Your preference was saved." />
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-[15px] text-red-700">
                Something went wrong. Please try again.
              </p>
            )}
            <p className="mt-6 text-[17px]">
              {vendor.lifecycle_unsubscribed_at ? "You're unsubscribed from tips and monthly summaries." : "You're getting tips and monthly summaries."}
            </p>
            <form action={setVendorLifecycleEmails} className="mt-6">
              <input type="hidden" name="token" value={token as string} />
              <input type="hidden" name="subscribe" value={vendor.lifecycle_unsubscribed_at ? "1" : "0"} />
              <SubmitButton variant={vendor.lifecycle_unsubscribed_at ? "forest" : "secondary"} pendingLabel="Saving">
                {vendor.lifecycle_unsubscribed_at ? "Turn them back on" : "Unsubscribe"}
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </Container>
  );
}
