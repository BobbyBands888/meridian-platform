"use server";

import { redirect } from "next/navigation";
import { isAlertToken, unsubscribePath } from "@/lib/listing-alerts";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unsubscribeFromAlerts(formData: FormData) {
  const token = formData.get("token");
  if (!isAlertToken(token)) redirect("/alerts/unsubscribe");

  const { error } = await createAdminClient()
    .from("listing_alerts")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("listing alert unsubscribe failed", error.code, error.message);
    redirect(`${unsubscribePath(token)}&error=1`);
  }
  redirect(unsubscribePath(token));
}
