import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { safeNextPath } from "@/lib/auth";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { confirmSignIn } from "./actions";
import { ConfirmForm } from "./continue-button";

export const metadata: Metadata = {
  title: "Continue signing in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmPage({ params: routeParams, searchParams }: PageProps<"/[market]/auth/confirm">) {
  const market = await requireMarket((await routeParams).market);
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const next = safeNextPath(params.next);
  const hasLink = Boolean((value("token_hash") && value("type")) || value("code"));
  const listing = Boolean(value("draft"));

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        {hasLink ? (
          <>
            <h1 className="text-4xl font-bold tracking-tight">{listing ? "Confirm your listing" : "Continue signing in"}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted">
              {listing
                ? `Tap the button to confirm your email. Your listing goes to our review queue and you're signed in to ${brandName(market)}.`
                : `Tap the button to finish signing in to ${brandName(market)}.`}
            </p>
            <ConfirmForm
              action={confirmSignIn}
              listing={listing}
              fields={{ token_hash: value("token_hash"), type: value("type"), code: value("code"), next, draft: value("draft") }}
            />
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight">That link is incomplete</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted">
              Copy the whole link from your email, or{" "}
              <a href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-forest underline underline-offset-2">
                request a new sign-in link
              </a>
              .
            </p>
          </>
        )}
      </div>
    </Container>
  );
}
