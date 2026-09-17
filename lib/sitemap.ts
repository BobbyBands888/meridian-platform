export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

/**
 * Last-modified date for pages whose content is written in code (home, /sell, /vendors, /guides, area pages, the hub, ...).
 * Bump it whenever that static page copy changes. Pages backed by records use the records' own dates instead.
 */
export const SITE_CONTENT_UPDATED_AT = "2026-09-17";

/** SITE_CONTENT_UPDATED_AT as a Date. */
export const siteContentDate = () => new Date(`${SITE_CONTENT_UPDATED_AT}T12:00:00Z`);

/** The newest of some record dates, or the static content date when there are none. */
export function latestDate(dates: (string | null | undefined)[]) {
  const times = dates.map((d) => (d ? Date.parse(d) : NaN)).filter((t) => !Number.isNaN(t));
  return times.length > 0 ? new Date(Math.max(...times)) : siteContentDate();
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** sitemaps.org XML for a list of absolute URLs. */
export function sitemapResponse(entries: SitemapEntry[], maxAge = 3600) {
  const urls = entries
    .map((e) =>
      [
        "<url>",
        `<loc>${escapeXml(e.url)}</loc>`,
        e.lastModified && !Number.isNaN(e.lastModified.getTime()) ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "",
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
