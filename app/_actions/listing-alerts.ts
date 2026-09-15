"use server";

import { headers } from "next/headers";
import { isServiceZip } from "@/lib/areas";
import { sendAlertConfirmation } from "@/lib/listing-alerts";
import { getRequestMarket } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export type AlertSignupState = {
  status?: "subscribed" | "error";
  message?: string;
  errors?: Partial<Record<"email" | "zip", string>>;
  values?: { email: string; zip: string };
};

export async function subscribeToListingAlerts(_prev: AlertSignupState, formData: FormData): Promise<AlertSignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const zip = String(formData.get("zip") ?? "").trim();
  const token = String(formData.get("turnstile_token") ?? "");
  const values = { email, zip };

  const market = await getRequestMarket();
  const errors: AlertSignupState["errors"] = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Enter a valid email address.";
  if (zip && !/^\d{5}$/.test(zip)) errors.zip = "Enter a 5-digit ZIP, or leave it blank.";
  else if (zip && !isServiceZip(market, zip)) errors.zip = `That ZIP is outside the ${market.region} area we cover. Leave it blank to hear about every new home.`;
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(token, ip))) {
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values };
  }

  const admin = createAdminClient();
  const zipValue = zip || null;
  const { data: existing, error: lookupError } = await admin
    .from("listing_alerts")
    .select("id, zip, unsubscribed_at, unsubscribe_token")
    .eq("market_id", market.id)
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("listing alert lookup failed", lookupError.code, lookupError.message);
    return { status: "error", message: "We couldn't sign you up. Please try again.", values };
  }

  // Confirm new signups, returning subscribers, and ZIP changes. A repeat of an identical active signup is saved
  // quietly, so the form can't be used to send someone the same email over and over.
  let confirmToken: string | null = null;
  if (!existing) {
    const { data, error } = await admin.from("listing_alerts").insert({ email, zip: zipValue, market_id: market.id }).select("unsubscribe_token").single();
    if (error && error.code !== "23505") {
      console.error("listing alert insert failed", error.code, error.message);
      return { status: "error", message: "We couldn't sign you up. Please try again.", values };
    }
    confirmToken = data?.unsubscribe_token ?? null; // 23505: a simultaneous submit already saved it.
  } else if (existing.unsubscribed_at || existing.zip !== zipValue) {
    const { error } = await admin.from("listing_alerts").update({ zip: zipValue, unsubscribed_at: null }).eq("id", existing.id);
    if (error) {
      console.error("listing alert update failed", error.code, error.message);
      return { status: "error", message: "We couldn't sign you up. Please try again.", values };
    }
    confirmToken = existing.unsubscribe_token;
  }

  if (confirmToken) await sendAlertConfirmation(market, { email, zip: zipValue, token: confirmToken });

  // The same message in every case, so the form doesn't reveal whether an address was already signed up.
  return {
    status: "subscribed",
    message: `You're on the list. We'll email ${email} when new homes are listed${zipValue ? ` in ${zipValue}` : ""}.`,
  };
}
