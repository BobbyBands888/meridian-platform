import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isProfileComplete, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing. Handles both the token_hash link (works across devices; see SETUP.md for the email
// template) and Supabase's default PKCE ?code= link (works only in the browser that requested it).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [pathname, query = ""] = path.split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  };

  if (!tokenHash && !code) {
    return redirectTo(`/sign-in?error=missing-link&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code ?? "");

  if (error) {
    console.error("auth confirm failed", error.status, error.message);
    return redirectTo(`/sign-in?error=link-invalid&next=${encodeURIComponent(next)}`);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle()
    : { data: null };

  return isProfileComplete(profile) ? redirectTo(next) : redirectTo(`/welcome?next=${encodeURIComponent(next)}`);
}
