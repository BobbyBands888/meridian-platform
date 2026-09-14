import type { MetadataRoute } from "next";
import { site, vendorCategories } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: site.url, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/homes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site.url}/sell`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/vendors`, changeFrequency: "weekly", priority: 0.8 },
    ...vendorCategories.map((c) => ({
      url: `${site.url}/vendors/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${site.url}/guides`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${site.url}/legal`, changeFrequency: "yearly", priority: 0.3 },
  ];
  return staticPages.map((page) => ({ ...page, lastModified: now }));
}
