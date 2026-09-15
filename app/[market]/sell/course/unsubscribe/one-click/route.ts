import { isCourseToken } from "@/lib/course";
import { createAdminClient } from "@/lib/supabase/admin";

/** RFC 8058 one-click unsubscribe, POSTed by mail apps from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isCourseToken(token)) return new Response("Invalid unsubscribe link", { status: 400 });

  const { error } = await createAdminClient()
    .from("course_signups")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("course one-click unsubscribe failed", error.code, error.message);
    return new Response("Could not unsubscribe", { status: 500 });
  }
  return new Response("Unsubscribed", { status: 200, headers: { "Cache-Control": "no-store" } });
}
