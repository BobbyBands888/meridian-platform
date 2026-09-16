"use server";

import { headers } from "next/headers";
import { isServiceZip } from "@/lib/areas";
import { getRequestMarket } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export type AreaWaitlistState = {
  status?: "saved" | "error";
  message?: string;
  errors?: Partial<Record<"email" | "zip", string>>;
  values?: { email: string; zip: string };
};

/** Saves the email of someone whose home is outside the market's ZIP codes, for when we expand to their area. */
export async function joinAreaWaitlist(_prev: AreaWaitlistState, formData: FormData): Promise<AreaWaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const zip = String(formData.get("zip") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim().slice(0, 200) || null;
  const token = String(formData.get("turnstile_token") ?? "");
  const values = { email, zip };

  const market = await getRequestMarket();
  const errors: AreaWaitlistState["errors"] = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  if (!/^\d{5}$/.test(zip)) errors.zip = "Enter your home's 5-digit ZIP.";
  else if (isServiceZip(market, zip)) errors.zip = `Good news: we already serve ZIP ${zip}.`;
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(token, ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values };
  }

  const { error } = await createAdminClient().from("area_waitlist").insert({ email, zip, market_id: market.id, source });
  // 23505: this email already asked about this ZIP.
  if (error && error.code !== "23505") {
    console.error("area waitlist insert failed", error.code, error.message);
    return { status: "error", message: "We couldn't save your email. Please try again.", values };
  }

  return { status: "saved", message: `Thanks — we'll email you when we expand to ${zip}.` };
}
