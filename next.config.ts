import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/sell/get-ready", destination: "/sell/checklist", permanent: true }];
  },
  // Guides and the checklist are read from content/ at request time (for revalidation), and many market pages look up
  // the market's disclosure guide, so ship the content folder with every route.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*.md"],
  },
  images: {
    // Listing photos and vendor headshots are served from Supabase Storage public buckets.
    remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/**")],
    // 85 for the listing gallery (large, full-screen photos), the default 75 everywhere else.
    qualities: [75, 85],
    // Screen widths the optimizer resizes to. Listing photo masters are at most 3200px, so the largest step is 3200
    // (a 3840 step would only store the same image again), and fewer steps means fewer transformations to pay for.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2560, 3200],
    // Cached copies live as long as the source's Cache-Control, which is a year for listing photos (immutable paths).
  },
};

export default nextConfig;
