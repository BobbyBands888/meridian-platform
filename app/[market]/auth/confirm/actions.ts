"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { track } from "@vercel/analytics/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { isProfileComplete, safeNextPath } from "@/lib/auth";
import { logFunnelEvent } from "@/lib/funnel-log";
import { clearDraftCookie, finalizeDraft, isDraftId } from "@/lib/listing-drafts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestMarket } from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

// Uses the one-time token only when the person presses "Continue signing in". Email security scanners that
// pre-open links only issue a GET, so they can no longer burn the token before the recipient clicks.
export async function confirmSignIn(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const tokenHash = String(formData.get("token_hash") ?? "");
  const typeValue = String(formData.get("type") ?? "");
  const code = String(formData.get("code") ?? "");
  const type = OTP_TYPES.includes(typeValue as EmailOtpType) ? (typeValue as EmailOtpType) : null;

  if (!(tokenHash && type) && !code) {
    redirect(`/sign-in?error=missing-link&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code);

  const draftId = formData.get("draft");
  if (error) {
    // A second click on an already-used listing confirmation link: the listing went through the first time.
    if (isDraftId(draftId)) {
      const { data: done } = await createAdminClient().from("listing_drafts").select("status").eq("id", draftId).maybeSingle();
      if (done?.status === "verified") redirect(next);
    }
    console.error("auth confirm failed", error.status, error.message);
    redirect(`/sign-in?error=link-invalid&next=${encodeURIComponent(next)}`);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  // The profile is read alongside finalizing the draft rather than after it. Finalizing only fills in a name or phone
  // the profile doesn't have yet, from the draft, so the draft's values stand in for those below.
  const profileRead = userId ? supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle() : null;

  // A link from "Confirm your email to submit your listing": the draft becomes a listing in the review queue, on this
  // account (new or existing) as long as the verified email is the one on the draft.
  const email = claims?.claims?.email as string | undefined;
  let fromDraft: { full_name: string | null; phone: string | null } | null = null;
  if (isDraftId(draftId) && userId && email) {
    const market = await getRequestMarket();
    const finalized = await finalizeDraft(market, draftId, { id: userId, email });
    if (!finalized) redirect("/sell?draft=unavailable");
    await clearDraftCookie();
    if (!finalized.already) {
      fromDraft = { full_name: finalized.fullName ?? null, phone: finalized.phone ?? null };
      const requestHeaders = await headers();
      after(async () => {
        await Promise.all([
          track("email_verified", { source: finalized.source ?? "direct" }, { headers: requestHeaders }).catch(() => {}),
          logFunnelEvent(market.id, "email_verified", finalized.source, draftId),
        ]);
      });
    }
  }
  const profile = profileRead ? (await profileRead).data : null;
  const complete = isProfileComplete(profile && { full_name: profile.full_name ?? fromDraft?.full_name ?? null, phone: profile.phone ?? fromDraft?.phone ?? null });

  redirect(complete ? next : `/welcome?next=${encodeURIComponent(next)}`);
}
