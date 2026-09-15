import "server-only";
import type { Lead } from "@/lib/database.types";
import { fullAddress } from "@/lib/listings";
import { getMarkets } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

/** All-time and last-30-day inquiry counts for one vendor or listing, read under the recipient's own RLS. */
export async function getInquiryCounts(type: Lead["type"], targetId: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const base = () => supabase.from("leads").select("id", { count: "exact", head: true }).eq("type", type).eq("target_id", targetId);
  const [all, recent] = await Promise.all([base(), base().gte("created_at", since)]);
  return { allTime: all.count ?? 0, last30Days: recent.count ?? 0 };
}

export async function getInquiries(type: Lead["type"], targetId: string, limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, sender_name, sender_email, sender_phone, message, created_at")
    .eq("type", type)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export type LeadWithTarget = Lead & { targetLabel: string; targetHref: string; recipientEmail: string | null };

/** Admin only: leads with the vendor or listing they were sent to. Uses the secret key; call after an admin check. */
export async function attachLeadTargets(leads: Lead[]): Promise<LeadWithTarget[]> {
  const admin = createAdminClient();
  const markets = new Map((await getMarkets()).map((m) => [m.id, m]));
  const vendorIds = [...new Set(leads.filter((l) => l.type === "vendor").map((l) => l.target_id))];
  const listingIds = [...new Set(leads.filter((l) => l.type === "listing").map((l) => l.target_id))];

  const [{ data: vendors }, { data: listings }] = await Promise.all([
    vendorIds.length
      ? admin.from("vendors").select("id, business_name, profiles!inner(email)").in("id", vendorIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string; profiles: { email: string } }[] }),
    listingIds.length
      ? admin.from("listings").select("id, street, city, zip, profiles!inner(email)").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; street: string; city: string; zip: string; profiles: { email: string } }[] }),
  ]);

  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v]));
  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));

  return leads.map((lead) => {
    if (lead.type === "vendor") {
      const v = vendorMap.get(lead.target_id);
      return { ...lead, targetLabel: v?.business_name ?? "Deleted vendor", targetHref: `/admin/vendors/${lead.target_id}`, recipientEmail: v?.profiles.email ?? null };
    }
    const l = listingMap.get(lead.target_id);
    const market = markets.get(lead.market_id);
    return { ...lead, targetLabel: l && market ? fullAddress(market, l) : "Deleted listing", targetHref: `/admin/listings/${lead.target_id}`, recipientEmail: l?.profiles.email ?? null };
  });
}
