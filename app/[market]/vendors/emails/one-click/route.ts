import { createAdminClient } from "@/lib/supabase/admin";
import { isVendorEmailToken } from "@/lib/vendor-email-prefs";

/** RFC 8058 one-click unsubscribe from vendor lifecycle emails, POSTed by mail apps from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isVendorEmailToken(token)) return new Response("Invalid unsubscribe link", { status: 400 });

  const { error } = await createAdminClient()
    .from("vendors")
    .update({ lifecycle_unsubscribed_at: new Date().toISOString() })
    .eq("email_token", token)
    .is("lifecycle_unsubscribed_at", null);
  if (error) {
    console.error("vendor one-click unsubscribe failed", error.code, error.message);
    return new Response("Could not unsubscribe", { status: 500 });
  }
  return new Response("Unsubscribed", { status: 200, headers: { "Cache-Control": "no-store" } });
}
