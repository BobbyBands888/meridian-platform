export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** sitemaps.org XML for a list of absolute URLs. */
export function sitemapResponse(entries: SitemapEntry[], maxAge = 3600) {
  const urls = entries
    .map((e) =>
      [
        "<url>",
        `<loc>${escapeXml(e.url)}</loc>`,
        e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "",
        e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : "",
        e.priority !== undefined ? `<priority>${e.priority}</priority>` : "",
        "</url>",
      ].join(""),
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": `public, max-age=0, s-maxage=${maxAge}` },
  });
}

export function robotsResponse({ origin, disallow }: { origin: string; disallow: string[] }) {
  const body = ["User-Agent: *", "Allow: /", ...disallow.map((d) => `Disallow: ${d}`), "", `Host: ${origin}`, `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
