"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { VendorCategoryValue } from "@/lib/database.types";
import { getMarketById, getRequestMarket } from "@/lib/market-data";
import { vendorCategories } from "@/lib/site";
import { CACHE_TAGS } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { sendAdminNewVendor, sendAdminVendorEdit, sendVendorReceived } from "@/lib/vendor-emails";
import { BIO_MAX, countSentences, isOwnHeadshotUrl, normalizeWebsite } from "@/lib/vendors";

const CERTIFICATIONS = ["licensed", "insured", "understands_connector", "handles_own_agreements", "read_terms"] as const;

export type VendorFormValues = {
  business_name: string;
  category: VendorCategoryValue | "";
  headshot_url: string;
  bio: string;
  service_area: string;
  price_range: string;
  website: string;
  certifications: string[];
};

type Field = Exclude<keyof VendorFormValues, "certifications"> | "certifications";

export type VendorFormState = {
  status?: "error";
  message?: string;
  errors?: Partial<Record<Field, string>>;
  values?: VendorFormValues;
  submittedAt?: number;
};

function readForm(formData: FormData): VendorFormValues {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    business_name: text("business_name").replace(/\s+/g, " "),
    category: (text("category") as VendorCategoryValue) || "",
    headshot_url: text("headshot_url"),
    bio: text("bio"),
    service_area: text("service_area"),
    price_range: text("price_range"),
    website: text("website"),
    certifications: CERTIFICATIONS.filter((c) => formData.get(c) === "on"),
  };
}

function validate(values: VendorFormValues, userId: string, requireCertifications: boolean) {
  const errors: VendorFormState["errors"] = {};
  if (values.business_name.length < 2 || values.business_name.length > 120) errors.business_name = "Enter your business name.";
  if (!vendorCategories.some((c) => c.value === values.category)) errors.category = "Choose a category.";
  if (!values.headshot_url) errors.headshot_url = "Upload a headshot.";
  else if (!isOwnHeadshotUrl(values.headshot_url, userId)) errors.headshot_url = "Upload your headshot again.";
  if (values.bio.length > BIO_MAX) errors.bio = `Keep your bio to ${BIO_MAX} characters.`;
  else if (countSentences(values.bio) < 2) errors.bio = "Write at least two full sentences.";
  if (values.service_area.length < 2) errors.service_area = "Enter the area you serve.";
  if (values.price_range.length < 1) errors.price_range = "Enter your starting price range.";
  const website = normalizeWebsite(values.website);
  if (website === "invalid") errors.website = "Enter a valid web address, or leave it blank.";
  if (requireCertifications && values.certifications.length !== CERTIFICATIONS.length) {
    errors.certifications = "Check all five boxes to join.";
  }
  return { errors, website: website === "invalid" ? null : website };
}



export async function joinVendorDirectory(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/vendors/join");
  const values = readForm(formData);
  const { errors, website } = validate(values, user.id, true);
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values, submittedAt: Date.now() };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("vendors").select("id").eq("profile_id", user.id).maybeSingle();
  if (existing) redirect("/dashboard/vendor");

  // Vendors join the market whose site they're on, including coming-soon markets (pre-registration).
  const market = await getRequestMarket();
  const { data: vendorId, error } = await supabase.rpc("submit_vendor_application", {
    p_market: market.slug,
    p_category: values.category as VendorCategoryValue,
    p_business_name: values.business_name,
    p_headshot_url: values.headshot_url,
    p_bio: values.bio,
    p_service_area: values.service_area,
    p_price_range: values.price_range,
    p_website: website ?? "",
    p_licensed: true,
    p_insured: true,
    p_understands_connector: true,
    p_handles_own_agreements: true,
    p_read_terms: true,
  });

  if (error || !vendorId) {
    console.error("vendor application failed", error?.code, error?.message);
    return { status: "error", message: "We couldn't submit your profile. Please try again.", values, submittedAt: Date.now() };
  }

  const vendor = { id: vendorId, business_name: values.business_name, category: values.category as VendorCategoryValue };
  const profile = await getCurrentProfile();
  const email = profile?.email ?? user.email;
  await Promise.all([sendVendorReceived(market, email, vendor), sendAdminNewVendor(market, { ...vendor, email })]);

  revalidatePath("/[market]/dashboard", "page");
  redirect("/dashboard/vendor?submitted=1");
}

export async function updateVendorProfile(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard/vendor/edit");
  const values = readForm(formData);
  const { errors, website } = validate(values, user.id, false);
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values, submittedAt: Date.now() };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("vendors").select("*").eq("profile_id", user.id).maybeSingle();
  if (!before) redirect("/vendors/join");
  const market = await getMarketById(before.market_id);
  // Profiles are managed on their own market's site; the dashboard there explains where to go.
  if (market.slug !== (await getRequestMarket()).slug) redirect("/dashboard/vendor");
  const { data: pendingBefore } = await supabase
    .from("vendor_pending_edits")
    .select("business_name, bio, headshot_url, category")
    .eq("vendor_id", before.id)
    .maybeSingle();

  const { error } = await supabase
    .from("vendors")
    .update({
      category: values.category as VendorCategoryValue,
      business_name: values.business_name,
      headshot_url: values.headshot_url,
      bio: values.bio,
      service_area: values.service_area,
      price_range: values.price_range,
      website,
    })
    .eq("id", before.id);

  if (error) {
    console.error("vendor update failed", error.code, error.message);
    return { status: "error", message: "We couldn't save your changes. Please try again.", values, submittedAt: Date.now() };
  }

  const email = (await getCurrentProfile())?.email ?? user.email;
  let outcome = "saved";

  if (before.status === "approved") {
    const matchesLive =
      values.business_name === before.business_name &&
      values.bio === before.bio &&
      values.headshot_url === before.headshot_url &&
      values.category === before.category;
    const sameAsPending =
      pendingBefore?.business_name === values.business_name &&
      pendingBefore?.bio === values.bio &&
      pendingBefore?.headshot_url === values.headshot_url &&
      pendingBefore?.category === values.category;

    if (matchesLive && pendingBefore) {
      // Reviewed fields were put back to what's live: withdraw the pending edit.
      await supabase.rpc("queue_vendor_edit", {
        p_vendor_id: before.id,
        p_business_name: before.business_name,
        p_bio: before.bio,
        p_headshot_url: before.headshot_url,
        p_category: before.category,
      });
    } else if (!matchesLive) {
      outcome = "edit-pending";
      if (!sameAsPending) await sendAdminVendorEdit(market, { id: before.id, business_name: values.business_name, category: values.category as VendorCategoryValue, email });
    }
    // Service area, pricing, and website apply immediately.
    updateTag(CACHE_TAGS.vendors);
  } else if (before.status === "rejected") {
    outcome = "resubmitted";
    await sendAdminNewVendor(market, { id: before.id, business_name: values.business_name, category: values.category as VendorCategoryValue, email }, true);
  }

  redirect(`/dashboard/vendor?${outcome}=1`);
}
