import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, TONES, type DescriptionVariant } from "@/lib/ai-description";
import { checkFairHousing } from "@/lib/fair-housing";
import { DESCRIPTION_MAX } from "@/lib/listings";

/**
 * "Write it for me" on the sell form. Claude gets only the facts the seller typed and is told to invent nothing,
 * so the draft can't introduce a detail the seller never claimed. Whatever comes back still goes through the same
 * Fair Housing filter as anything a seller writes by hand, and the seller has to accept a version before it's used.
 */

/** Roughly what a run costs at this length: a few hundred input tokens and well under a thousand out. */
const MAX_TOKENS = 2000;

export type DescriptionFacts = {
  beds: number;
  baths: number;
  sqft: number | null;
  yearBuilt: number | null;
  area: string;
  city: string;
  stateCode: string;
  /** What the seller typed in the "notable features" box. The only free text Claude sees. */
  features: string;
};

export type DescriptionResult =
  | { ok: true; variants: DescriptionVariant[]; dropped: number; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: string };

const SYSTEM = `You write descriptions for homes that owners are selling themselves, without an agent.

Rules, in order of importance:
1. Use only the details given. Invent nothing. No finishes, appliances, renovations, condition, views, lot size, schools, commute times, parking, or history unless the seller listed it. If a detail isn't given, leave it out rather than guessing.
2. Never describe who the home is for, or who lives nearby. No mention of families, children, couples, singles, age, retirees, empty nesters, race, nationality, religion, churches, disability, or income. Never call an area safe, exclusive, desirable, up-and-coming, or similar.
3. Say "primary bedroom", never "master".
4. Describe the home and the facts given, not the market. No pricing advice, no urgency, no "won't last", no investment claims.
5. Plain American English. No emoji, no ALL CAPS, no exclamation marks.

Write three versions of the same description:
- straightforward: plain and factual, 80 to 120 words.
- warm: inviting and human, still only the given facts, 80 to 120 words.
- short: the tightest of the three, around 80 words.`;

function factsPrompt(facts: DescriptionFacts) {
  const lines = [
    `Bedrooms: ${facts.beds}`,
    `Bathrooms: ${facts.baths}`,
    facts.sqft ? `Finished square feet: ${facts.sqft}` : null,
    facts.yearBuilt ? `Year built: ${facts.yearBuilt}` : null,
    `Area: ${facts.area}`,
    `City: ${facts.city}, ${facts.stateCode}`,
    "",
    "What the owner says is notable about the home:",
    facts.features,
  ].filter((line) => line !== null);
  return lines.join("\n");
}

const SCHEMA = {
  type: "object",
  properties: Object.fromEntries(TONES.map((tone) => [tone, { type: "string" }])),
  required: [...TONES],
  additionalProperties: false,
} as const;

let client: Anthropic | null = null;
function anthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic({ apiKey });
  return client;
}

/** Trims to a single paragraph of plain text and drops anything obviously over length. */
function tidy(text: unknown) {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_MAX);
}

export async function writeDescriptions(facts: DescriptionFacts): Promise<DescriptionResult> {
  let response;
  try {
    response = await anthropic().messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: factsPrompt(facts) }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Too many requests right now. Try again in a minute." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("ai description: ANTHROPIC_API_KEY was rejected");
      return { ok: false, error: "Writing descriptions isn't available right now." };
    }
    console.error("ai description failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return { ok: false, error: "We couldn't write a description just now. Please try again." };
  }

  const parsed = response.parsed_output as Record<string, unknown> | null;
  if (!parsed) {
    console.error("ai description: response didn't match the schema", response.stop_reason);
    return { ok: false, error: "We couldn't write a description just now. Please try again." };
  }

  // The same filter a seller's own writing goes through. A version that trips it is thrown away, not shown.
  const candidates = TONES.map((tone) => ({ tone, text: tidy(parsed[tone]) })).filter((v) => v.text.length > 0);
  const variants = candidates.filter((v) => checkFairHousing(v.text).length === 0);
  const dropped = candidates.length - variants.length;
  if (dropped > 0) console.warn(`ai description: dropped ${dropped} version(s) that tripped the Fair Housing filter`);

  if (variants.length === 0) {
    return { ok: false, error: "The drafts didn't pass our Fair Housing check. Try again, or write the description yourself." };
  }

  return {
    ok: true,
    variants,
    dropped,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
