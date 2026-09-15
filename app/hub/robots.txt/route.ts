import { hubUrl } from "@/lib/markets";
import { robotsResponse } from "@/lib/sitemap";

export function GET() {
  return robotsResponse({ origin: hubUrl(), disallow: [] });
}
