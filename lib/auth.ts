import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Profile } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Only allow same-site relative paths as post-sign-in destinations. */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

export function isProfileComplete(profile: Pick<Profile, "full_name" | "phone"> | null): boolean {
  return Boolean(profile?.full_name && profile.phone);
}

/** The verified user id and email for this request, or null when signed out. */
export const getCurrentUser = cache(async () => {
  if (!getSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? "" };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** Redirects to sign-in when signed out, and to onboarding until name and phone are set. */
export async function requireProfile(nextPath: string): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  const profile = await getCurrentProfile();
  if (!profile || !isProfileComplete(profile)) redirect(`/welcome?next=${encodeURIComponent(nextPath)}`);
  return profile;
}

/** Admin-only pages: anyone else gets a 404 so the page's existence isn't revealed. */
export async function requireAdmin(nextPath: string): Promise<Profile> {
  const profile = await requireProfile(nextPath);
  if (!profile.is_admin) notFound();
  return profile;
}
