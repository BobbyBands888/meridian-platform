"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

// Drop query strings (sign-in tokens, search terms) and skip auth pages entirely.
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        if (url.pathname.startsWith("/auth/")) return null;
        url.search = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
