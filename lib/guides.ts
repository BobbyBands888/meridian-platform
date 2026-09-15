import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";
import { cache } from "react";
import type { VendorCategoryValue } from "@/lib/database.types";
import { vendorCategories } from "@/lib/site";

export type GuideMeta = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  vendorCategories: VendorCategoryValue[];
  readingMinutes: number;
};

export type Guide = GuideMeta & { html: string };

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORY_VALUES = new Set<string>(vendorCategories.map((c) => c.value));

/** Minimal front matter: `key: value` lines, quoted strings, and `[a, b]` lists. */
function parseFrontMatter(source: string) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("Guide is missing front matter.");
  const data: Record<string, string | string[]> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      data[kv[1]] = raw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      data[kv[1]] = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
  return { data, body: match[2] };
}

// Guides are written by the site owner, so rendered HTML is trusted. External links open in a new tab.
const marked = new Marked({
  gfm: true,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      const titleAttr = title ? ` title="${title}"` : "";
      return external
        ? `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
        : `<a href="${href}"${titleAttr}>${text}</a>`;
    },
  },
});

async function loadGuide(slug: string): Promise<Guide | null> {
  if (!SLUG.test(slug)) return null;
  let source: string;
  try {
    source = await readFile(path.join(GUIDES_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  const { data, body } = parseFrontMatter(source.replace(/\r\n/g, "\n"));
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  const title = str("title");
  if (!title || !str("description") || !str("publishedAt")) throw new Error(`Guide ${slug} needs title, description, and publishedAt.`);

  const categories = (Array.isArray(data.vendorCategories) ? data.vendorCategories : []).filter((c): c is VendorCategoryValue => CATEGORY_VALUES.has(c));
  const words = body.replace(/[#>*_`\[\]()-]/g, " ").split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title,
    seoTitle: str("seoTitle") || title,
    description: str("description"),
    publishedAt: str("publishedAt"),
    updatedAt: str("updatedAt") || str("publishedAt"),
    vendorCategories: categories,
    readingMinutes: Math.max(1, Math.round(words / 230)),
    html: await marked.parse(body),
  };
}

export const getGuide = cache(loadGuide);

export const getGuides = cache(async (): Promise<GuideMeta[]> => {
  const files = (await readdir(GUIDES_DIR)).filter((f) => f.endsWith(".md"));
  const guides = await Promise.all(files.map((f) => loadGuide(f.replace(/\.md$/, ""))));
  return guides
    .filter((g): g is Guide => g !== null)
    .map((g): GuideMeta => ({
      slug: g.slug,
      title: g.title,
      seoTitle: g.seoTitle,
      description: g.description,
      publishedAt: g.publishedAt,
      updatedAt: g.updatedAt,
      vendorCategories: g.vendorCategories,
      readingMinutes: g.readingMinutes,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
});

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
export const formatGuideDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`));
