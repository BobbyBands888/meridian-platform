import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/sell/get-ready", destination: "/sell/checklist", permanent: true }];
  },
  // Guides are read from content/ at request time (for revalidation), so ship those files with the server bundle.
  outputFileTracingIncludes: {
    "/guides": ["./content/guides/**/*.md"],
    "/guides/[slug]": ["./content/guides/**/*.md"],
    "/sitemap.xml": ["./content/guides/**/*.md"],
  },
  images: {
    // Listing photos and vendor headshots are served from Supabase Storage public buckets.
    remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/**")],
  },
};

export default nextConfig;
