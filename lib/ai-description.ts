/**
 * Shared pieces of the "Write it for me" helper on the sell form: the model it uses, the three tones it returns,
 * and the limits on the seller's notable-features box. The call itself is server-only, in lib/anthropic.ts.
 */

export const AI_MODEL = "claude-sonnet-4-6";

export const TONES = ["straightforward", "warm", "short"] as const;
export type Tone = (typeof TONES)[number];

export type DescriptionVariant = { tone: Tone; text: string };

/** Enough for Claude to have something to work with, and short enough to stay a list of features. */
export const FEATURES_MIN = 15;
export const FEATURES_MAX = 1200;

const toneLabels: Record<Tone, string> = {
  straightforward: "Straightforward",
  warm: "Warm",
  short: "Short",
};

export const toneLabel = (tone: Tone) => toneLabels[tone];
