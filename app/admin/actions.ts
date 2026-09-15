"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/supabase/public";
import { sendListingApproved, sendListingRejected } from "@/lib/listing-emails";
import { sendVendorApproved, sendVendorEditApproved, sendVendorEditDeclined, sendVendorRejected } from "@/lib/vendor-emails";

async function assertAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Not authorized.");
}

async function loadVendor(vendorId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("vendors").select("id, business_name, category, status, profiles!inner(email)").eq("id", vendorId).single();
  if (!data) throw new Error("Vendor not found.");
  return { admin, vendor: data };
}

// Every public page that shows vendors reads through the "vendors" cache tag, so expiring it refreshes
// category lists, profiles, and the sitemap on their next request.
function revalidateVendor() {
  updateTag(CACHE_TAGS.vendors);
}

export async function approveVendor(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor } = await loadVendor(vendorId);
  const { error } = await admin.from("vendors").update({ status: "approved" }).eq("id", vendorId);
  if (error) throw new Error(error.message);
  await sendVendorApproved(vendor.profiles.email, vendor);
  revalidateVendor();
  redirect(`/admin/vendors/${vendorId}?done=approved`);
}

export async function rejectVendor(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const { admin, vendor } = await loadVendor(vendorId);
  const { error } = await admin.from("vendors").update({ status: "rejected" }).eq("id", vendorId);
  if (error) throw new Error(error.message);
  await admin.from("vendor_pending_edits").delete().eq("vendor_id", vendorId);
  await sendVendorRejected(vendor.profiles.email, vendor, note);
  revalidateVendor();
  redirect(`/admin/vendors/${vendorId}?done=rejected`);
}

export async function approveVendorEdit(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor } = await loadVendor(vendorId);
  const { data: applied, error } = await admin.rpc("apply_vendor_edit", { p_vendor_id: vendorId });
  if (error) throw new Error(error.message);
  if (applied) {
    await sendVendorEditApproved(vendor.profiles.email, vendor);
    revalidateVendor();
  }
  redirect(`/admin/vendors/${vendorId}?done=edit-approved`);
}

export async function declineVendorEdit(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const { admin, vendor } = await loadVendor(vendorId);
  const { error } = await admin.from("vendor_pending_edits").delete().eq("vendor_id", vendorId);
  if (error) throw new Error(error.message);
  await sendVendorEditDeclined(vendor.profiles.email, vendor, note);
  redirect(`/admin/vendors/${vendorId}?done=edit-declined`);
}

async function loadListing(listingId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listings")
    .select("id, slug, street, city, zip, hide_exact_address, price, status, profiles!inner(email)")
    .eq("id", listingId)
    .single();
  if (!data) throw new Error("Listing not found.");
  return { admin, listing: data };
}

export async function approveListing(formData: FormData) {
  await assertAdmin();
  const listingId = String(formData.get("listing_id"));
  const { admin, listing } = await loadListing(listingId);
  const { error } = await admin.from("listings").update({ status: "active" }).eq("id", listingId);
  if (error) throw new Error(error.message);
  await sendListingApproved(listing.profiles.email, listing);
  updateTag(CACHE_TAGS.listings);
  redirect(`/admin/listings/${listingId}?done=approved`);
}

export async function rejectListing(formData: FormData) {
  await assertAdmin();
  const listingId = String(formData.get("listing_id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const { admin, listing } = await loadListing(listingId);
  const wasPublic = ["active", "under_contract", "sold"].includes(listing.status);
  const { error } = await admin.from("listings").update({ status: "rejected" }).eq("id", listingId);
  if (error) throw new Error(error.message);
  await sendListingRejected(listing.profiles.email, listing, note);
  if (wasPublic) updateTag(CACHE_TAGS.listings);
  redirect(`/admin/listings/${listingId}?done=rejected`);
}
