"use server";

import { headers } from "next/headers";
import { safeNextPath } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { site } from "@/lib/site";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

// Link back to the host the visitor is on (production, a Vercel preview, or local dev), never an arbitrary Host header.
async function requestOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (/^localhost(:\d+)?$/.test(host)) return `http://${host}`;
  if (host === "nashvillebuys.com" || host === "www.nashvillebuys.com" || host.endsWith(".vercel.app")) return `https://${host}`;
  return site.url;
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    const rateLimited = error.status === 429 || /rate limit|security purposes/i.test(error.message);
    console.error("signInWithOtp failed", error.status, error.message);
    return {
      status: "error",
      email,
      message: rateLimited
        ? "Too many sign-in emails were requested. Wait a minute, then try again."
        : "We couldn't send your sign-in link. Please try again.",
    };
  }

  return {
    status: "sent",
    email,
    message: `Check ${email} for a sign-in link. It expires in one hour.`,
  };
}
