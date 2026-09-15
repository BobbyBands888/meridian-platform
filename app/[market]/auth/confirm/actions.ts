"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isProfileComplete, safeNextPath } from "@/lib/auth";
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

  if (error) {
    console.error("auth confirm failed", error.status, error.message);
    redirect(`/sign-in?error=link-invalid&next=${encodeURIComponent(next)}`);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle()
    : { data: null };

  redirect(isProfileComplete(profile) ? next : `/welcome?next=${encodeURIComponent(next)}`);
}
