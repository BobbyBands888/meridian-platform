"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVendorEmailToken, vendorEmailsPath } from "@/lib/vendor-email-prefs";

/** Turns vendor tips and monthly summaries off or back on. Approval and inquiry emails aren't affected. */
export async function setVendorLifecycleEmails(formData: FormData) {
  const token = formData.get("token");
  if (!isVendorEmailToken(token)) redirect("/vendors/emails");
  const subscribe = formData.get("subscribe") === "1";

  const { error } = await createAdminClient()
    .from("vendors")
    .update({ lifecycle_unsubscribed_at: subscribe ? null : new Date().toISOString() })
    .eq("email_token", token);
  if (error) {
    console.error("vendor email preference update failed", error.code, error.message);
    redirect(`${vendorEmailsPath(token)}&error=1`);
  }
  redirect(`${vendorEmailsPath(token)}&saved=1`);
}
