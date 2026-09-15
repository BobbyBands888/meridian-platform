"use server";

import { redirect } from "next/navigation";
import { courseUnsubscribePath, isCourseToken } from "@/lib/course";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unsubscribeFromCourse(formData: FormData) {
  const token = formData.get("token");
  if (!isCourseToken(token)) redirect("/sell/course/unsubscribe");

  const { error } = await createAdminClient()
    .from("course_signups")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("course unsubscribe failed", error.code, error.message);
    redirect(`${courseUnsubscribePath(token)}&error=1`);
  }
  redirect(courseUnsubscribePath(token));
}
