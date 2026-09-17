import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { brandName, serviceArea, type Market } from "@/lib/markets";
import { plannedVendorCategories, vendorCategories, type ModuleCategory } from "@/lib/site";

export type ChecklistStep = {
  id: string;
  number: number;
  title: string;
  body: string;
  categories: ModuleCategory[];
};

export type ChecklistSection = { number: number; title: string; steps: ChecklistStep[] };

export type Checklist = { title: string; disclaimer: string; closingNote: string; sections: ChecklistSection[] };

/** Which checklist: the seller's pre-sale list, the buyer's, or the new homeowner's first year. */
export type ChecklistKind = "seller" | "buyer" | "moved_in";

const CHECKLIST_FILES: Record<ChecklistKind, string> = {
  seller: "checklist.md",
  buyer: "buyer-checklist.md",
  moved_in: "moved-in-checklist.md",
};

// "(Home Inspectors)" or "(Painters, Handymen)" marks a step with vendor categories, by the directory's label or its URL
// slug ("(Attorneys)" still works now that the label is "Closing Attorneys & Title"). Planned trades are tagged by slug:
// "(Roofers)", "(HVAC)", "(Pest Control)", "(Foundation Crawlspace)".
const labelToCategory = new Map<string, ModuleCategory>(
  [...vendorCategories, ...plannedVendorCategories].flatMap((c) => [
    [c.label.toLowerCase(), c.value],
    [c.slug.replace(/-/g, " "), c.value],
  ]),
);

function extractCategories(text: string) {
  const categories: ModuleCategory[] = [];
  const cleaned = text.replace(/\s*\(([^()]+)\)/g, (match, inner: string) => {
    const parts = inner.split(/\s*(?:,|\band\b|&)\s*/i).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const found = parts.map((p) => labelToCategory.get(p));
    if (parts.length === 0 || found.some((c) => !c)) return match; // An ordinary parenthetical: keep it.
    for (const c of found) if (c && !categories.includes(c)) categories.push(c);
    return "";
  });
  return { text: cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim(), categories };
}

/** First sentence is the step's title; the rest is its explanation. A sentence may end inside quotes: `Saturday."` */
function splitTitle(text: string) {
  const match = text.match(/^([\s\S]+?[.!?]["”'’)]*)(?:\s+|$)([\s\S]*)$/);
  return match ? { title: match[1].trim(), body: match[2].trim() } : { title: text.trim(), body: "" };
}

export function parseChecklist(markdown: string): Checklist {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const disclaimer: string[] = [];
  const closing: string[] = [];
  const sections: ChecklistSection[] = [];
  let current: { number: number; text: string[] } | null = null;

  const flushStep = () => {
    if (!current || sections.length === 0) return;
    // An optional stable id, "{#preapproval}", keeps saved checkmarks attached to the step when steps are renumbered.
    // With an id, everything before it is the title (which may be more than one sentence) and everything after is the body.
    const joined = current.text.join(" ");
    const idMatch = joined.match(/\s*\{#([a-z0-9-]{2,60})\}\s*/);
    const { text, categories } = extractCategories(idMatch ? joined.replace(idMatch[0], " {#} ") : joined);
    const [head, tail] = idMatch ? text.split(/\s*\{#\}\s*/, 2) : [text, null];
    const { title: stepTitle, body } = tail === null ? splitTitle(head) : { title: head.trim(), body: tail.trim() };
    const id = idMatch ? idMatch[1] : `step-${current.number}`;
    sections[sections.length - 1].steps.push({ id, number: current.number, title: stepTitle, body, categories });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
    } else if (line.startsWith("## ")) {
      flushStep();
      const heading = line.slice(3).trim();
      const m = heading.match(/^Section\s+(\d+)\s*[—–:-]\s*(.+)$/i);
      sections.push({ number: m ? Number(m[1]) : sections.length + 1, title: m ? m[2].trim() : heading, steps: [] });
    } else if (/^\d+\.\s/.test(line)) {
      flushStep();
      const m = line.match(/^(\d+)\.\s+(.*)$/)!;
      current = { number: Number(m[1]), text: [m[2]] };
    } else if (line === "") {
      flushStep();
    } else if (current) {
      current.text.push(line); // Wrapped continuation of the step.
    } else if (sections.length === 0 && title) {
      disclaimer.push(line);
    } else if (sections.length > 0) {
      closing.push(line); // A paragraph after the last step: the closing note.
    }
  }
  flushStep();

  return { title, disclaimer: disclaimer.join(" "), closingNote: closing.join(" "), sections };
}

/**
 * content/checklist.md is shared by every market. Placeholders fill in what differs by state:
 * {brand} "Nashville Buys", {name} "Nashville", {region} "Greater Nashville & Middle Tennessee", {state} "Tennessee",
 * {closing} the market's closing note ("attorney or title company"), {disclosure} its disclosure note.
 */
export function fillMarketPlaceholders(text: string, market: Market) {
  const values: Record<string, string> = {
    brand: brandName(market),
    name: market.name,
    region: serviceArea(market, market.region),
    state: market.state,
    closing: market.closing_note,
    disclosure: market.disclosure_note,
  };
  return text.replace(/\{(brand|name|region|state|closing|disclosure)\}/g, (_, key: string) => values[key]);
}

const readChecklistFile = cache((kind: ChecklistKind) => readFile(path.join(process.cwd(), "content", CHECKLIST_FILES[kind]), "utf8"));

export async function getChecklist(market: Market, kind: ChecklistKind = "seller") {
  return parseChecklist(fillMarketPlaceholders(await readChecklistFile(kind), market));
}
