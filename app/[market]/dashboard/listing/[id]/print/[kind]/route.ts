import { getCurrentUser } from "@/lib/auth";
import { buildListingPdf, printFileName, type PrintKind } from "@/lib/listing-print";
import { requireMarket } from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KINDS: PrintKind[] = ["sign", "flyer"];

/**
 * The yard sign and flyer PDFs, built on demand for the seller who owns the listing. Row-level security already
 * limits the query to their own listings; the seller_id filter makes that explicit and returns a 404 either way,
 * so the route never confirms that someone else's listing id exists.
 */
export async function GET(_request: Request, { params }: RouteContext<"/[market]/dashboard/listing/[id]/print/[kind]">) {
  const { market: marketSlug, id, kind } = await params;
  if (!KINDS.includes(kind as PrintKind)) return new Response("Not found", { status: 404 });

  const market = await requireMarket(marketSlug);
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to print your listing.", { status: 401 });

  const supabase = await createClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("slug, price, beds, baths, sqft, city, zip, listing_photos(url, sort_order)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("market_id", market.id)
    .maybeSingle();
  if (error) console.error("print: listing lookup failed", error.code, error.message);
  if (!listing) return new Response("Not found", { status: 404 });

  const cover = [...listing.listing_photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
  const pdf = await buildListingPdf(kind as PrintKind, market, listing, cover);

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // Opens in the browser's PDF viewer, where printing and saving are one click away.
      "Content-Disposition": `inline; filename="${printFileName(kind as PrintKind, market, listing)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
