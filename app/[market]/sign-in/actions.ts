"use server";

import { headers } from "next/headers";
import { safeNextPath } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getMarkets, getRequestMarket } from "@/lib/market-data";
import { brandName, marketOrigin, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { verifyTurnstile } from "@/lib/turnstile";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const MINUTE_MS = 60_000;

/**
 * Link back to the host the visitor is on, so the session cookie lands on that site: any market domain (with or
 * without www), a Vercel preview, or local development (localhost and tampa.localhost style hosts). Any other Host
 * header gets the market's canonical address instead.
 */
async function requestOrigin(market: Market) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (/^([a-z0-9-]+\.)?localhost(:\d+)?$/.test(host)) return `http://${host}`;
  if (host.endsWith(".vercel.app")) return `https://${host}`;
  const domains = (await getMarkets()).map((m) => m.domain);
  if (domains.includes(host.replace(/^www\./, ""))) return `https://${host}`;
  return marketOrigin(market);
}

/**
 * One sign-in email per address per minute, and five per hour. Supabase enforced this when it sent the emails; the
 * app sends them now (so each market's own sender and brand are used), so it keeps the limit itself.
 */
async function allowSignInEmail(email: string) {
  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * MINUTE_MS).toISOString();
  const { data, error } = await admin.from("sign_in_link_requests").select("created_at").eq("email", email).gte("created_at", hourAgo);
  if (error) throw new Error(`sign-in rate limit check failed: ${error.message}`);
  const lastMinute = data.filter((r) => Date.parse(r.created_at) > Date.now() - MINUTE_MS).length;
  if (lastMinute >= 1 || data.length >= 5) return false;
  await admin.from("sign_in_link_requests").insert({ email });
  await admin.from("sign_in_link_requests").delete().eq("email", email).lt("created_at", hourAgo);
  return true;
}

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
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    console.error("generateLink failed", error?.status, error?.message);
    return failed;
  }

  // generateLink creates the account on first use. Record the site they signed up on, once, for the admin's
  // Buyers tab; a null market_id means the account predates this.
  await createAdminClient().from("profiles").update({ market_id: market.id }).eq("email", email).is("market_id", null);

  const link = `${await requestOrigin(market)}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email&next=${encodeURIComponent(next)}`;
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
