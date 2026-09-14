"use server";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

// Magic-link sign-in is wired to Supabase Auth in Phase 2.
export async function requestMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address.", email };
  }
  return { status: "error", message: "Sign-in isn't open yet. Please check back soon.", email };
}
