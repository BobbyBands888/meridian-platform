import { hubUrl } from "@/lib/markets";
import { siteContentDate, sitemapResponse } from "@/lib/sitemap";

export function GET() {
  return sitemapResponse([{ url: hubUrl(), changeFrequency: "monthly", priority: 1, lastModified: siteContentDate() }]);
}
