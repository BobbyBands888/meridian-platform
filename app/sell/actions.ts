"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { ListingStatus } from "@/lib/database.types";
import { checkFairHousing, type FairHousingIssue } from "@/lib/fair-housing";
import { sendAdminDescriptionEdit, sendAdminNewListing, sendListingReceived } from "@/lib/listing-emails";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, LISTING_PHOTO_MAX } from "@/lib/listings";
import { cityForZip, isServiceZip } from "@/lib/areas";
import { CACHE_TAGS } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

type Field = "street" | "zip" | "price" | "beds" | "baths" | "sqft" | "description" | "photos" | "status";

export type ListingFormValues = {
  street: string;
  zip: string;
  hide_exact_address: boolean;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  description: string;
  photo_urls: string[];
  status?: ListingStatus;
};

export type ListingFormState = {
  status?: "error" | "saved";
  message?: string;
  errors?: Partial<Record<Field, string>>;
  fairHousing?: FairHousingIssue[];
  values?: ListingFormValues;
  submittedAt?: number;
};

function readForm(formData: FormData): ListingFormValues {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    street: text("street").replace(/\s+/g, " "),
    zip: text("zip"),
    hide_exact_address: formData.get("hide_exact_address") === "on",
    price: text("price"),
    beds: text("beds"),
    baths: text("baths"),
    sqft: text("sqft"),
    description: text("description"),
    photo_urls: formData.getAll("photo_urls").map(String).filter(Boolean),
    status: (text("status") || undefined) as ListingStatus | undefined,
  };
}

const toInt = (v: string) => (/^\d+$/.test(v.replace(/[$,\s]/g, "")) ? Number(v.replace(/[$,\s]/g, "")) : NaN);

function isOwnPhoto(url: string, userId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/listing-photos/${userId}/`) && !url.includes("..");
}

function validateShared(values: ListingFormValues, userId: string) {
  const errors: ListingFormState["errors"] = {};
  const price = toInt(values.price);
  if (!Number.isFinite(price) || price < 1000 || price > 100_000_000) errors.price = "Enter an asking price in whole dollars.";
  if (values.description.length < DESCRIPTION_MIN) errors.description = `Write at least ${DESCRIPTION_MIN} characters so buyers know what makes the home special.`;
  if (values.description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX.toLocaleString()} characters.`;
  const photos = values.photo_urls;
  if (photos.length < 1) errors.photos = "Add at least one photo.";
  else if (photos.length > LISTING_PHOTO_MAX) errors.photos = `Use ${LISTING_PHOTO_MAX} photos or fewer.`;
  else if (!photos.every((u) => isOwnPhoto(u, userId))) errors.photos = "Some photos didn't upload correctly. Remove them and add them again.";
  const fairHousing = checkFairHousing(values.description);
  return { errors, price, fairHousing };
}

export async function createListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/sell");
  const values = readForm(formData);
  const { errors, price, fairHousing } = validateShared(values, user.id);

  if (values.street.length < 3 || values.street.length > 160 || !/\d/.test(values.street)) errors.street = "Enter the street address, like 1234 Main St.";
  if (!isServiceZip(values.zip)) errors.zip = "Choose a ZIP code in Davidson, Williamson, Rutherford, Sumner, or Wilson County.";
  const beds = Number(values.beds);
  if (!Number.isInteger(beds) || beds < 0 || beds > 20) errors.beds = "Enter the number of bedrooms.";
  const baths = Number(values.baths);
  if (!Number.isFinite(baths) || baths < 0 || baths > 20 || (baths * 2) % 1 !== 0) errors.baths = "Enter bathrooms in halves, like 2 or 2.5.";
  const sqft = toInt(values.sqft);
  if (!Number.isFinite(sqft) || sqft < 100 || sqft > 50_000) errors.sqft = "Enter the finished square footage.";

  if (Object.keys(errors).length > 0 || fairHousing.length > 0) {
    return {
      status: "error",
      message: fairHousing.length > 0 && Object.keys(errors).length === 0 ? "Edit the highlighted phrases in your description to continue." : "Please fix the highlighted fields.",
      errors,
      fairHousing,
      values,
      submittedAt: Date.now(),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_listing", {
    p_street: values.street,
    p_city: cityForZip(values.zip),
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
    city: cityForZip(values.zip),
    zip: values.zip,
    hide_exact_address: values.hide_exact_address,
    price,
  };
  const email = (await getCurrentProfile())?.email ?? user.email;
  await Promise.all([sendListingReceived(email, listing), sendAdminNewListing(listing, email)]);

  redirect("/sell/checklist?submitted=1");
}

const SELLER_STATUSES: ListingStatus[] = ["active", "under_contract", "sold"];

export async function updateListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await getCurrentUser();
  const listingId = String(formData.get("listing_id") ?? "");
  if (!user) redirect(`/sign-in?next=/dashboard/listing/${listingId}`);
  const values = readForm(formData);
  const { errors, price, fairHousing } = validateShared(values, user.id);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("listings")
    .select("id, slug, street, city, zip, hide_exact_address, price, status, description")
    .eq("id", listingId)
    .maybeSingle();
  if (!current) redirect("/dashboard/listing");

  const nextStatus = values.status && SELLER_STATUSES.includes(current.status) && SELLER_STATUSES.includes(values.status) ? values.status : current.status;

  if (Object.keys(errors).length > 0 || fairHousing.length > 0) {
    return {
      status: "error",
      message: fairHousing.length > 0 && Object.keys(errors).length === 0 ? "Edit the highlighted phrases in your description to continue." : "Please fix the highlighted fields.",
      errors,
      fairHousing,
      values,
      submittedAt: Date.now(),
    };
  }

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
      await sendAdminDescriptionEdit({ ...current, price }, email, current.description, values.description);
    }
  }
  return { status: "saved", message: "Your listing was updated.", values: { ...values, status: nextStatus }, submittedAt: Date.now() };
}
