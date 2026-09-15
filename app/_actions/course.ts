"use server";

import { headers } from "next/headers";
import { hasListedAHome, sendNextLesson } from "@/lib/course";
import { getRequestMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export type CourseSignupState = {
  status?: "subscribed" | "error";
  message?: string;
  errors?: Partial<Record<"email", string>>;
  values?: { email: string };
};

export async function subscribeToCourse(_prev: CourseSignupState, formData: FormData): Promise<CourseSignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const source = String(formData.get("source") ?? "").trim().slice(0, 200) || null;
  const token = String(formData.get("turnstile_token") ?? "");
  const values = { email };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { status: "error", message: "Please fix the highlighted field.", errors: { email: "Enter a valid email address." }, values };
  }

  const market = await getRequestMarket();
  if (!isLive(market)) return { status: "error", message: "The course isn't available here yet.", values };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(token, ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values };
  }

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("course_signups")
    .select("id, next_day, unsubscribe_token, unsubscribed_at, completed_at, last_sent_at")
    .eq("market_id", market.id)
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("course signup lookup failed", lookupError.code, lookupError.message);
    return { status: "error", message: "We couldn't sign you up. Please try again.", values };
  }

  // Someone who already has a listing is past the course; say yes and send nothing.
  const listed = await hasListedAHome(email);

  let signup = existing;
  if (!existing) {
    const { data, error } = await admin
      .from("course_signups")
      .insert({ email, market_id: market.id, source, ...(listed ? { completed_at: new Date().toISOString() } : {}) })
      .select("id, next_day, unsubscribe_token, unsubscribed_at, completed_at, last_sent_at")
      .single();
    if (error && error.code !== "23505") {
      console.error("course signup insert failed", error.code, error.message);
      return { status: "error", message: "We couldn't sign you up. Please try again.", values };
    }
    signup = data ?? null; // 23505: a simultaneous submit already saved it.
  } else if (existing.unsubscribed_at && !existing.completed_at) {
    // Someone coming back picks up where they left off.
    const { error } = await admin.from("course_signups").update({ unsubscribed_at: null }).eq("id", existing.id);
    if (error) console.error("course resubscribe failed", error.code, error.message);
  }

  // Day 1 goes out now, so the signup confirms itself. The daily job takes over from day 2.
  if (signup && !listed && !signup.completed_at && !signup.last_sent_at) {
    await sendNextLesson({ ...signup, email, market_id: market.id }, market);
  }

  // The same message either way, so the form never reveals whether an address was already signed up.
  return {
    status: "subscribed",
    message: `You're in. The first email is on its way to ${email}, and the rest arrive one a day for the next six days.`,
  };
}
