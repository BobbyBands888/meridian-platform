"use server";

import { headers } from "next/headers";
import { safeNextPath } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getRequestMarket } from "@/lib/market-data";
import { brandName } from "@/lib/markets";
import { allowSignInEmail, createSignInLink } from "@/lib/sign-in";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { verifyTurnstile } from "@/lib/turnstile";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function requestMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(formData.get("next"));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { status: "error", message: "Enter a valid email address.", email };
  }
  // Turnstile keeps bots from using the form to send sign-in emails to arbitrary addresses.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(String(formData.get("turnstile_token") ?? ""), ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", email };
  }

  if (!getSupabaseEnv()) {
    return { status: "error", message: "Sign-in isn't available right now. Please try again later.", email };
  }

  const market = await getRequestMarket();
  const failed: SignInState = { status: "error", email, message: "We couldn't send your sign-in link. Please try again." };

  try {
    if (!(await allowSignInEmail(email))) {
      return { status: "error", email, message: "Too many sign-in emails were requested. Wait a minute, then try again." };
    }
  } catch (error) {
    console.error(error);
    return failed;
  }

  // Creates the account on first sign-in. The token is used on the confirm page, on this same site.
  const link = await createSignInLink(market, email, next);
  if (!link) return failed;

  const brand = brandName(market);
  const sent = await sendEmail({
    market,
    to: email,
    subject: `Your ${brand} sign-in link`,
    heading: `Sign in to ${brand}`,
    blocks: [
      { kind: "p", text: "Use the button below to sign in. The link works once and expires in one hour." },
      { kind: "button", label: `Sign in to ${brand}`, href: link },
      { kind: "p", text: "If you didn't ask to sign in, you can ignore this email. No account changes were made." },
    ],
  });
  if (!sent) return failed;

  return {
    status: "sent",
    email,
    message: `Check ${email} for a sign-in link. It expires in one hour.`,
  };
}
