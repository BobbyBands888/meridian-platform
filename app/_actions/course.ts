"use server";

import { headers } from "next/headers";
import { enrollInCourse } from "@/lib/course";
import { getRequestMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
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

  if (!(await enrollInCourse(market, email, source))) {
    return { status: "error", message: "We couldn't sign you up. Please try again.", values };
  }

  // The same message either way, so the form never reveals whether an address was already signed up.
  return {
    status: "subscribed",
    message: `You're in. The first email is on its way to ${email}, and the rest arrive one a day for the next six days.`,
  };
}
