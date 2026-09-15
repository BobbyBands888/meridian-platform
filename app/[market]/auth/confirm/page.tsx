import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { safeNextPath } from "@/lib/auth";
import { requireMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { confirmSignIn } from "./actions";
import { ContinueButton } from "./continue-button";

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

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        {hasLink ? (
          <>
            <h1 className="text-4xl font-bold tracking-tight">Continue signing in</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted">Tap the button to finish signing in to {brandName(market)}.</p>
            <form action={confirmSignIn} className="mt-8">
              <input type="hidden" name="token_hash" value={value("token_hash")} />
              <input type="hidden" name="type" value={value("type")} />
              <input type="hidden" name="code" value={value("code")} />
              <input type="hidden" name="next" value={next} />
              <ContinueButton />
            </form>
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
