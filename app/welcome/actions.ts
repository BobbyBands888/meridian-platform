"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";
import { normalizeUsPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  status?: "error" | "saved";
  message?: string;
  errors?: Partial<Record<"full_name" | "phone" | "roles", string>>;
  values?: { full_name: string; phone: string; roles: UserRole[] };
  submittedAt?: number;
};

const ROLES: UserRole[] = ["buyer", "seller", "vendor"];

async function saveProfile(formData: FormData): Promise<ProfileFormState | null> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const phoneInput = String(formData.get("phone") ?? "").trim();
  const roles = formData.getAll("roles").map(String).filter((r): r is UserRole => ROLES.includes(r as UserRole));

  const errors: ProfileFormState["errors"] = {};
  if (fullName.length < 2 || fullName.length > 120) errors.full_name = "Enter your full name.";
  const phone = normalizeUsPhone(phoneInput);
  if (!phone) errors.phone = "Enter a 10-digit US phone number.";
  if (roles.length === 0) errors.roles = "Choose at least one.";

  const values = { full_name: fullName, phone: phoneInput, roles };
  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values, submittedAt: Date.now() };
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/welcome")}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone, roles: [...new Set(roles)] })
    .eq("id", user.id);

  if (error) {
    console.error("profile update failed", error.code, error.message);
    return { status: "error", message: "We couldn't save your details. Please try again.", values, submittedAt: Date.now() };
  }

  revalidatePath("/dashboard");
  return null;
}

export async function completeOnboarding(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const failure = await saveProfile(formData);
  if (failure) return failure;
  redirect(safeNextPath(formData.get("next")));
}

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const failure = await saveProfile(formData);
  if (failure) return failure;
  redirect("/dashboard?saved=1");
}
