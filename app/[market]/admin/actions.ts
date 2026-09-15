"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMarketById } from "@/lib/market-data";
import type { MarketStatus } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/supabase/public";
import { sendListingApproved, sendListingRejected } from "@/lib/listing-emails";
import { sendVendorApproved, sendVendorEditApproved, sendVendorEditDeclined, sendVendorRejected, sendVendorVerified } from "@/lib/vendor-emails";

async function assertAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Not authorized.");
}

/** Sends the admin back where the action started (a tab or a detail page) with a result notice. */
function finish(formData: FormData, fallback: string, done: string): never {
  const back = String(formData.get("return_to") ?? "");
  const base = back.startsWith("/admin") && !back.startsWith("//") ? back : fallback;
  const url = new URL(base, "http://admin.local");
  url.searchParams.set("done", done);
  redirect(`${url.pathname}${url.search}`);
}

const note = (formData: FormData) => String(formData.get("note") ?? "").trim().slice(0, 2000);

async function loadVendor(vendorId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vendors")
    .select("id, business_name, category, status, market_id, profiles!inner(email), vendor_pending_edits(vendor_id)")
    .eq("id", vendorId)
    .single();
  if (!data) throw new Error("Vendor not found.");
  return { admin, vendor: data, market: await getMarketById(data.market_id) };
}

async function loadListing(listingId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listings")
    .select("id, slug, street, city, zip, hide_exact_address, price, status, market_id, profiles!inner(email)")
    .eq("id", listingId)
    .single();
  if (!data) throw new Error("Listing not found.");
  return { admin, listing: data, market: await getMarketById(data.market_id) };
}

// Every public page that shows vendors or listings reads through these cache tags, so expiring them refreshes
// lists, detail pages, and the sitemap on their next request.
const refreshVendors = () => updateTag(CACHE_TAGS.vendors);
const refreshListings = () => updateTag(CACHE_TAGS.listings);

export async function approveVendor(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor, market } = await loadVendor(vendorId);
  // Already handled (a double click, or two admins at once): don't send a second email.
  if (vendor.status === "approved") finish(formData, `/admin/vendors/${vendorId}`, "already");
  const { error } = await admin.from("vendors").update({ status: "approved" }).eq("id", vendorId);
  if (error) throw new Error(error.message);
  await sendVendorApproved(market, vendor.profiles.email, vendor);
  refreshVendors();
  finish(formData, `/admin/vendors/${vendorId}`, "approved");
}

export async function rejectVendor(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor, market } = await loadVendor(vendorId);
  if (vendor.status === "rejected") finish(formData, `/admin/vendors/${vendorId}`, "already");
  const { error } = await admin.from("vendors").update({ status: "rejected" }).eq("id", vendorId);
  if (error) throw new Error(error.message);
  await admin.from("vendor_pending_edits").delete().eq("vendor_id", vendorId);
  await sendVendorRejected(market, vendor.profiles.email, vendor, note(formData));
  if (vendor.status === "approved") refreshVendors();
  finish(formData, `/admin/vendors/${vendorId}`, "rejected");
}

export async function approveVendorEdit(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor, market } = await loadVendor(vendorId);
  const { data: applied, error } = await admin.rpc("apply_vendor_edit", { p_vendor_id: vendorId });
  if (error) throw new Error(error.message);
  if (!applied) finish(formData, `/admin/vendors/${vendorId}`, "already");
  await sendVendorEditApproved(market, vendor.profiles.email, vendor);
  refreshVendors();
  finish(formData, `/admin/vendors/${vendorId}`, "edit-approved");
}

export async function declineVendorEdit(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor, market } = await loadVendor(vendorId);
  if (!vendor.vendor_pending_edits) finish(formData, `/admin/vendors/${vendorId}`, "already");
  const { error } = await admin.from("vendor_pending_edits").delete().eq("vendor_id", vendorId);
  if (error) throw new Error(error.message);
  await sendVendorEditDeclined(market, vendor.profiles.email, vendor, note(formData));
  finish(formData, `/admin/vendors/${vendorId}`, "edit-declined");
}

export async function approveListing(formData: FormData) {
  await assertAdmin();
  const listingId = String(formData.get("listing_id"));
  const { admin, listing, market } = await loadListing(listingId);
  if (listing.status !== "pending" && listing.status !== "rejected") finish(formData, `/admin/listings/${listingId}`, "already");
  const { error } = await admin.from("listings").update({ status: "active" }).eq("id", listingId);
  if (error) throw new Error(error.message);
  await sendListingApproved(market, listing.profiles.email, listing);
  refreshListings();
  finish(formData, `/admin/listings/${listingId}`, "approved");
}

export async function rejectListing(formData: FormData) {
  await assertAdmin();
  const listingId = String(formData.get("listing_id"));
  const { admin, listing, market } = await loadListing(listingId);
  if (listing.status === "rejected") finish(formData, `/admin/listings/${listingId}`, "already");
  const wasPublic = ["active", "under_contract", "sold"].includes(listing.status);
  const { error } = await admin.from("listings").update({ status: "rejected" }).eq("id", listingId);
  if (error) throw new Error(error.message);
  await sendListingRejected(market, listing.profiles.email, listing, note(formData));
  if (wasPublic) refreshListings();
  finish(formData, `/admin/listings/${listingId}`, "rejected");
}

export async function saveVerification(formData: FormData) {
  await assertAdmin();
  const vendorId = String(formData.get("vendor_id"));
  const { admin, vendor, market } = await loadVendor(vendorId);
  const checks = {
    license_checked: formData.get("license_checked") === "on",
    coi_reviewed: formData.get("coi_reviewed") === "on",
    phone_call_done: formData.get("phone_call_done") === "on",
  };
  const markVerified = formData.get("verified") === "on";
  const adminNotes = String(formData.get("admin_notes") ?? "").trim().slice(0, 5000) || null;

  const { data: current } = await admin.from("vendor_verifications").select("verified_at, submitted_at").eq("vendor_id", vendorId).maybeSingle();

  // Verification needs all three review steps done. Save the progress (boxes and notes) without changing the badge.
  if (markVerified && !(checks.license_checked && checks.coi_reviewed && checks.phone_call_done)) {
    const { error } = await admin
      .from("vendor_verifications")
      .upsert({ vendor_id: vendorId, ...checks, admin_notes: adminNotes, verified_at: current?.verified_at ?? null }, { onConflict: "vendor_id" });
    if (error) throw new Error(error.message);
    finish(formData, `/admin/vendors/${vendorId}`, "verify-incomplete");
  }

  // Keep the original review date unless newer documents came in after it (a renewal) or it was never verified.
  const needsNewDate = !current?.verified_at || (current.submitted_at && current.submitted_at > current.verified_at);
  const verifiedAt = markVerified ? (needsNewDate ? new Date().toISOString() : current!.verified_at) : null;

  const { error } = await admin
    .from("vendor_verifications")
    .upsert({ vendor_id: vendorId, ...checks, admin_notes: adminNotes, verified_at: verifiedAt }, { onConflict: "vendor_id" });
  if (error) throw new Error(error.message);

  const badgeChanged = (current?.verified_at ?? null) !== verifiedAt;
  if (badgeChanged) refreshVendors();
  if (markVerified && badgeChanged && vendor.status === "approved") await sendVendorVerified(market, vendor.profiles.email, vendor, verifiedAt!);

  finish(formData, `/admin/vendors/${vendorId}#verification`, markVerified ? (badgeChanged ? "verified" : "verification-saved") : current?.verified_at ? "unverified" : "verification-saved");
}

/** Launches a market (coming_soon to live) or takes it back to coming soon. */
export async function setMarketStatus(formData: FormData) {
  await assertAdmin();
  const marketId = String(formData.get("market_id"));
  const status = String(formData.get("status")) as MarketStatus;
  if (status !== "live" && status !== "coming_soon") throw new Error("Invalid status.");
  if (formData.get("confirm") !== "on") finish(formData, "/admin?tab=markets", "confirm-required");
  const market = await getMarketById(marketId);
  if (market.status === status) finish(formData, "/admin?tab=markets", "already");
  const { error } = await createAdminClient().from("markets").update({ status }).eq("id", marketId);
  if (error) throw new Error(error.message);
  // Market status decides which vendors and listings are public and which pages exist, so refresh all three.
  updateTag(CACHE_TAGS.markets);
  refreshVendors();
  refreshListings();
  finish(formData, "/admin?tab=markets", status === "live" ? "market-live" : "market-coming-soon");
}
