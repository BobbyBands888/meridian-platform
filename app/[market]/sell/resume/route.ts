import { redirect } from "next/navigation";
import { DRAFT_RETENTION_DAYS, hashDraftToken, isDraftToken, setDraftCookie } from "@/lib/listing-drafts";
import { getMarket } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The "Finish my listing" link in the reminder email. Puts the resume token in this browser's draft cookie and
 * opens /sell. It changes nothing on the draft, so a mail scanner opening the link can't lock the seller out.
 */
export async function GET(request: Request, { params }: RouteContext<"/[market]/sell/resume">) {
  const market = await getMarket((await params).market);
  const token = new URL(request.url).searchParams.get("t");
  if (market && isDraftToken(token)) {
    const { data: draft } = await createAdminClient()
      .from("listing_drafts")
      .select("id, created_at, status")
      .eq("market_id", market.id)
      .eq("resume_token_hash", hashDraftToken(token))
      .neq("status", "verified")
      .maybeSingle();
    if (draft && Date.now() - Date.parse(draft.created_at) <= DRAFT_RETENTION_DAYS * 86_400_000) {
      await setDraftCookie(token);
    }
  }
  redirect("/sell");
}
