"use server";

import { redirect } from "next/navigation";
import { draftUnsubscribePath } from "@/lib/listing-drafts";
import { isCourseToken } from "@/lib/course";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unsubscribeFromDraftReminders(formData: FormData) {
  const token = formData.get("token");
  if (!isCourseToken(token)) redirect("/sell/resume/unsubscribe");

  const { error } = await createAdminClient()
    .from("listing_drafts")
    .update({ reminders_unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("reminders_unsubscribed_at", null);
  if (error) {
    console.error("draft reminder unsubscribe failed", error.code, error.message);
    redirect(`${draftUnsubscribePath(token)}&error=1`);
  }
  redirect(draftUnsubscribePath(token));
}
