// Reading and validating the listing form, shared by signed-in listing actions and unverified drafts.
import { listingZipError, type AreaMarket } from "@/lib/areas";
import type { ListingStatus } from "@/lib/database.types";
import { checkFairHousing, type FairHousingIssue } from "@/lib/fair-housing";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, LISTING_PHOTO_MAX } from "@/lib/listings";

export type ListingField = "street" | "zip" | "price" | "beds" | "baths" | "sqft" | "description" | "photos" | "status";

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
  errors?: Partial<Record<ListingField, string>>;
  fairHousing?: FairHousingIssue[];
  values?: ListingFormValues;
  submittedAt?: number;
};

export function readListingForm(formData: FormData): ListingFormValues {
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

export const toInt = (v: string) => (/^\d+$/.test(v.replace(/[$,\s]/g, "")) ? Number(v.replace(/[$,\s]/g, "")) : NaN);

/** Public URL prefix for a folder in the listing-photos bucket: a user id, or "drafts/<draft id>". */
export function listingPhotoPrefix(folder: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/listing-photos/${folder}/` : null;
}

export function isPhotoInFolder(url: string, folder: string) {
  const prefix = listingPhotoPrefix(folder);
  return Boolean(prefix) && url.startsWith(prefix!) && !url.includes("..");
}

/** Price, description, and photos: the fields both new listings and edits have. */
export function validateShared(values: ListingFormValues, { photoFolder, photoMax = LISTING_PHOTO_MAX }: { photoFolder: string; photoMax?: number }) {
  const errors: ListingFormState["errors"] = {};
  const price = toInt(values.price);
  if (!Number.isFinite(price) || price < 1000 || price > 100_000_000) errors.price = "Enter an asking price in whole dollars.";
  if (values.description.length < DESCRIPTION_MIN) errors.description = `Write at least ${DESCRIPTION_MIN} characters so buyers know what makes the home special.`;
  if (values.description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX.toLocaleString()} characters.`;
  const photos = values.photo_urls;
  if (photos.length < 1) errors.photos = "Add at least one photo.";
  else if (photos.length > photoMax) errors.photos = `Use ${photoMax} photos or fewer.`;
  else if (!photos.every((u) => isPhotoInFolder(u, photoFolder))) errors.photos = "Some photos didn't upload correctly. Remove them and add them again.";
  const fairHousing = checkFairHousing(values.description);
  return { errors, price, fairHousing };
}

/** Address, beds, baths, and square feet: fields only a new listing sets. Adds to `errors`. */
export function validateNewListingFields(market: AreaMarket, values: ListingFormValues, errors: NonNullable<ListingFormState["errors"]>) {
  if (values.street.length < 3 || values.street.length > 160 || !/\d/.test(values.street)) errors.street = "Enter the street address, like 1234 Main St.";
  const zipError = listingZipError(market, values.zip);
  if (zipError) errors.zip = zipError;
  const beds = Number(values.beds);
  if (values.beds === "" || !Number.isInteger(beds) || beds < 0 || beds > 20) errors.beds = "Enter the number of bedrooms.";
  const baths = Number(values.baths);
  if (values.baths === "" || !Number.isFinite(baths) || baths < 0 || baths > 20 || (baths * 2) % 1 !== 0) errors.baths = "Enter bathrooms in halves, like 2 or 2.5.";
  const sqft = toInt(values.sqft);
  if (!Number.isFinite(sqft) || sqft < 100 || sqft > 50_000) errors.sqft = "Enter the finished square footage.";
  return { beds, baths, sqft };
}

export function formErrorState(values: ListingFormValues, errors: NonNullable<ListingFormState["errors"]>, fairHousing: FairHousingIssue[]): ListingFormState {
  return {
    status: "error",
    message: fairHousing.length > 0 && Object.keys(errors).length === 0 ? "Edit the highlighted phrases in your description to continue." : "Please fix the highlighted fields.",
    errors,
    fairHousing,
    values,
    submittedAt: Date.now(),
  };
}
