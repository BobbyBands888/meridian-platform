"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { getMarketById } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COI_BUCKET, licenseRequired } from "@/lib/verification";
import { sendAdminVerificationSubmitted } from "@/lib/vendor-emails";

export type VerificationFormState = {
  status?: "error" | "submitted";
  message?: string;
  errors?: Partial<Record<"license_number" | "coi", string>>;
  licenseNumber?: string;
};

export async function submitVerification(_prev: VerificationFormState, formData: FormData): Promise<VerificationFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sign in again to continue." };

  const licenseNumber = String(formData.get("license_number") ?? "").trim().replace(/\s+/g, " ");
  const coiPath = String(formData.get("coi_path") ?? "");
  const coiFileName = String(formData.get("coi_file_name") ?? "").slice(0, 200);

  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("id, business_name, category, status, market_id").eq("profile_id", user.id).maybeSingle();
  if (!vendor || vendor.status !== "approved") {
    return { status: "error", message: "Verification opens once your profile is approved.", licenseNumber };
  }
  const { data: existing } = await supabase.from("vendor_verifications").select("submitted_at").eq("vendor_id", vendor.id).maybeSingle();

  const errors: VerificationFormState["errors"] = {};
  if (licenseRequired(vendor.category) && licenseNumber.length < 2) errors.license_number = "Enter your license number.";
  if (licenseNumber.length > 80) errors.license_number = "License numbers are at most 80 characters.";
  if (!coiPath) errors.coi = "Upload your certificate of insurance.";
  else if (!coiPath.startsWith(`${user.id}/`) || coiPath.includes("..")) errors.coi = "Upload your certificate of insurance again.";
  if (Object.keys(errors).length > 0) return { status: "error", message: "Please fix the highlighted fields.", errors, licenseNumber };

  // Confirm the file really landed in the private bucket before recording it.
  const admin = createAdminClient();
  const { error: fileError } = await admin.storage.from(COI_BUCKET).createSignedUrl(coiPath, 60);
  if (fileError) return { status: "error", message: "We couldn't find your uploaded file. Please upload it again.", errors: { coi: "Upload it again." }, licenseNumber };

  const { error } = await supabase.rpc("submit_vendor_verification", {
    p_license_number: licenseNumber,
    p_coi_path: coiPath,
    p_coi_file_name: coiFileName,
  });
  if (error) {
    console.error("verification submit failed", error.code, error.message);
    return { status: "error", message: error.message.includes("license") ? error.message : "We couldn't submit your documents. Please try again.", licenseNumber };
  }

  const email = (await getCurrentProfile())?.email ?? user.email;
  await sendAdminVerificationSubmitted(await getMarketById(vendor.market_id), { id: vendor.id, business_name: vendor.business_name, email }, Boolean(existing?.submitted_at));
  revalidatePath("/[market]/dashboard/vendor", "page");
  return { status: "submitted", message: "Thanks. We'll review your documents and email you when your badge is live." };
}
