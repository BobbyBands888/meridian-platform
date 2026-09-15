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
  },
};

export default nextConfig;
