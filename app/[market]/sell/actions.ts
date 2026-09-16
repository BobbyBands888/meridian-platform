"use server";

import { track } from "@vercel/analytics/server";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { ListingStatus } from "@/lib/database.types";
import { sendAdminDescriptionEdit, sendAdminNewListing, sendListingReceived } from "@/lib/listing-emails";
import { cityForZip } from "@/lib/areas";
import { logFunnelEvent } from "@/lib/funnel-log";
import { formErrorState, readListingForm, validateNewListingFields, validateShared, type ListingFormState } from "@/lib/listing-form";
import { getMarketById, getRequestMarket } from "@/lib/market-data";
import { isLive } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type { ListingFormState, ListingFormValues } from "@/lib/listing-form";

const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Write it for me" runs are logged before a listing exists, against the draft id the form carries. Once the
 * listing is created, point those rows at it so cost can be totalled per listing.
 */
async function attachAiUsage(draftId: string, profileId: string, listingId: string) {
  if (!DRAFT_ID.test(draftId)) return;
  const { error } = await createAdminClient()
    .from("listing_ai_usage")
    .update({ listing_id: listingId })
    .eq("draft_id", draftId)
    .eq("profile_id", profileId)
    .is("listing_id", null);
  if (error) console.error("ai usage attach failed", error.code, error.message);
}

export async function createListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/sell");
  const values = readListingForm(formData);
  const { errors, price, fairHousing } = validateShared(values, { photoFolder: user.id });

  const market = await getRequestMarket();
  if (!isLive(market)) redirect("/");
  const { beds, baths, sqft } = validateNewListingFields(market, values, errors);

  if (Object.keys(errors).length > 0 || fairHousing.length > 0) return formErrorState(values, errors, fairHousing);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_listing", {
    p_market: market.slug,
    p_street: values.street,
    p_city: cityForZip(market, values.zip),
    p_zip: values.zip,
    p_hide_exact_address: values.hide_exact_address,
    p_price: price,
    p_beds: beds,
    p_baths: baths,
    p_sqft: sqft,
    p_description: values.description,
    p_photo_urls: values.photo_urls,
  });

  const created = data?.[0];
  if (error || !created) {
    console.error("listing submit failed", error?.code, error?.message);
    return { status: "error", message: "We couldn't submit your listing. Please try again.", values, submittedAt: Date.now() };
  }

  const listing = {
    id: created.id,
    slug: created.slug,
    street: values.street,
    city: cityForZip(market, values.zip),
    zip: values.zip,
    hide_exact_address: values.hide_exact_address,
    price,
  };
  const email = (await getCurrentProfile())?.email ?? user.email;
  await Promise.all([
    sendListingReceived(market, email, listing),
    sendAdminNewListing(market, listing, email),
    attachAiUsage(String(formData.get("draft_id") ?? ""), user.id, created.id),
  ]);

  const source = String(formData.get("source") ?? "") || "direct";
  await Promise.all([
    track("submitted", { source, verified: true }, { headers: await headers() }).catch(() => {}),
    logFunnelEvent(market.id, "submitted", source),
  ]);
  redirect("/sell/checklist?submitted=1");
}

const SELLER_STATUSES: ListingStatus[] = ["active", "under_contract", "sold"];

export async function updateListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await getCurrentUser();
  const listingId = String(formData.get("listing_id") ?? "");
  if (!user) redirect(`/sign-in?next=/dashboard/listing/${listingId}`);
  const values = readListingForm(formData);
  const { errors, price, fairHousing } = validateShared(values, { photoFolder: user.id });

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("listings")
    .select("id, slug, street, city, zip, hide_exact_address, price, status, description, market_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!current) redirect("/dashboard/listing");
  const market = await getMarketById(current.market_id);
  // Listings are managed on their own market's site.
  if (market.slug !== (await getRequestMarket()).slug) redirect("/dashboard/listing");

  const nextStatus = values.status && SELLER_STATUSES.includes(current.status) && SELLER_STATUSES.includes(values.status) ? values.status : current.status;

  if (Object.keys(errors).length > 0 || fairHousing.length > 0) return formErrorState(values, errors, fairHousing);

  const { error: updateError } = await supabase
    .from("listings")
    .update({ price, description: values.description, status: nextStatus })
    .eq("id", listingId);
  if (updateError) {
    console.error("listing update failed", updateError.code, updateError.message);
    return { status: "error", message: "We couldn't save your changes. Please try again.", values, submittedAt: Date.now() };
  }

  const { error: photoError } = await supabase.rpc("replace_listing_photos", { p_listing_id: listingId, p_photo_urls: values.photo_urls });
  if (photoError) {
    console.error("photo update failed", photoError.code, photoError.message);
    return { status: "error", message: "Your details were saved, but photos couldn't be updated. Please try again.", values, submittedAt: Date.now() };
  }

  if (SELLER_STATUSES.includes(current.status)) {
    updateTag(CACHE_TAGS.listings);
    // Live description edits aren't re-reviewed, so the admin gets a copy to spot-check.
    if (values.description !== current.description) {
      const email = (await getCurrentProfile())?.email ?? user.email;
      await sendAdminDescriptionEdit(market, { ...current, price }, email, current.description, values.description);
    }
  }
  return { status: "saved", message: "Your listing was updated.", values: { ...values, status: nextStatus }, submittedAt: Date.now() };
}
