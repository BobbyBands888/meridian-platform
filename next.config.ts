import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/sell/get-ready", destination: "/sell/checklist", permanent: true }];
  },
  images: {
    // Listing photos and vendor headshots are served from Supabase Storage public buckets.
    remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/**")],
  },
};

export default nextConfig;
