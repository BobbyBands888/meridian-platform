import type { MetadataRoute } from "next";
import { site, vendorCategories } from "@/lib/site";
import { CACHE_TAGS, createPublicClient } from "@/lib/supabase/public";
import { vendorPath } from "@/lib/vendors";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: site.url, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${site.url}/homes`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${site.url}/sell`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: `${site.url}/vendors`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${site.url}/vendors/all`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    ...vendorCategories.map((c) => ({
      url: `${site.url}/vendors/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      lastModified: now,
    })),
    { url: `${site.url}/vendors/join`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${site.url}/guides`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${site.url}/legal`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
  ];

  const { data: vendors, error } = await createPublicClient({ tags: [CACHE_TAGS.vendors], revalidate: 3600 }).from("public_vendors").select("id, category, created_at");
  if (error) console.error("sitemap: vendors query failed", error.message);

  const vendorPages: MetadataRoute.Sitemap = (vendors ?? []).map((v) => ({
    url: `${site.url}${vendorPath(v)}`,
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: new Date(v.created_at),
  }));

  return [...staticPages, ...vendorPages];
}
