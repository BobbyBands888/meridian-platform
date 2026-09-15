import { cache } from "react";
import type { PublicListing } from "@/lib/database.types";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";

export type ListingWithCover = PublicListing & { cover_url: string | null };

export type ListingFilters = {
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  zips?: string[];
};

const client = () => createPublicClient({ tags: [CACHE_TAGS.listings] });

async function attachCovers(listings: PublicListing[]): Promise<ListingWithCover[]> {
  if (listings.length === 0) return [];
  const { data, error } = await client()
    .from("public_listing_photos")
    .select("listing_id, url, sort_order")
    .in("listing_id", listings.map((l) => l.id))
    .eq("sort_order", 0);
  if (error) throw new Error(`Could not load listing photos: ${error.message}`);
  const covers = new Map(data.map((p) => [p.listing_id, p.url]));
  return listings.map((l) => ({ ...l, cover_url: covers.get(l.id) ?? null }));
}

/** Active listings, newest first, with optional filters. */
export async function getActiveListings(filters: ListingFilters = {}, limit = 60): Promise<ListingWithCover[]> {
  let query = client().from("public_listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  if (filters.minPrice) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice) query = query.lte("price", filters.maxPrice);
  if (filters.beds) query = query.gte("beds", filters.beds);
  if (filters.baths) query = query.gte("baths", filters.baths);
  if (filters.zips?.length) query = query.in("zip", filters.zips);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load listings: ${error.message}`);
  return attachCovers(data);
}

/** A published listing (active, under contract, or sold) and its photos in order. */
export const getPublicListing = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return null;
  const { data: listing, error } = await client().from("public_listings").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Could not load listing: ${error.message}`);
  if (!listing) return null;
  const { data: photos, error: photoError } = await client()
    .from("public_listing_photos")
    .select("id, url, sort_order")
    .eq("listing_id", listing.id)
    .order("sort_order");
  if (photoError) throw new Error(`Could not load listing photos: ${photoError.message}`);
  return { listing, photos };
});

/** Slugs of listings that belong in the sitemap. */
export async function getSitemapListings() {
  const { data, error } = await client().from("public_listings").select("slug, updated_at").in("status", ["active", "under_contract"]);
  if (error) throw new Error(`Could not load listings: ${error.message}`);
  return data;
}
