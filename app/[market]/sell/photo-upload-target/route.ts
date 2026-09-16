import { claimDraftUploadTarget } from "@/lib/listing-drafts";
import { getMarket } from "@/lib/market-data";

export const dynamic = "force-dynamic";

/** POST: a signed upload URL for one photo in this browser's listing draft (see claimDraftUploadTarget). */
export async function POST(_request: Request, { params }: RouteContext<"/[market]/sell/photo-upload-target">) {
  const market = await getMarket((await params).market);
  if (!market) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(await claimDraftUploadTarget(market), { headers: { "Cache-Control": "no-store" } });
}
