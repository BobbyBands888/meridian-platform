// Screens listing descriptions for common phrases that express a preference or limitation based on a
// protected characteristic under the Fair Housing Act. Not legal advice and not exhaustive.

export type FairHousingIssue = {
  phrase: string;
  explanation: string;
  suggestion?: string;
};

type Rule = { pattern: RegExp; explanation: string; suggestion?: string };

const FAMILIAL = "Describes who should live here based on familial status, which Fair Housing law prohibits.";
const RELIGION = "Refers to religion, which can read as a preference for or against buyers of a faith.";
const DISABILITY = "Excludes people based on disability, which Fair Housing law prohibits.";
const NEIGHBORHOOD = "Describing a neighborhood as safe or exclusive can signal who is welcome. Describe specific features instead.";

const rules: Rule[] = [
  { pattern: /\bno (kids|children|child)\b/i, explanation: FAMILIAL },
  { pattern: /\b(adults?|over 55|seniors?) only\b/i, explanation: FAMILIAL },
  { pattern: /\bperfect for (a )?famil(y|ies)\b/i, explanation: FAMILIAL, suggestion: "Describe the space, like \"four bedrooms and a fenced yard\"." },
  { pattern: /\bideal for (a )?famil(y|ies)\b/i, explanation: FAMILIAL, suggestion: "Describe the space, like \"four bedrooms and a fenced yard\"." },
  { pattern: /\byoung (couple|professionals?|family)\b/i, explanation: "Refers to age or familial status, which can discourage other buyers." },
  { pattern: /\b(empty nesters?|singles only|bachelor pad|no couples)\b/i, explanation: FAMILIAL },
  { pattern: /\bchristians?\b/i, explanation: RELIGION },
  { pattern: /\b(no (wheelchairs?|handicap(ped)?|disabled)|able[- ]bodied)\b/i, explanation: DISABILITY },
  { pattern: /\bno section ?8\b/i, explanation: "Refusing housing vouchers can be source-of-income discrimination and often has a disparate impact on protected groups." },
  { pattern: /\bsafe (neighborhood|area|community|street)\b/i, explanation: NEIGHBORHOOD, suggestion: "Mention specific features, like \"sidewalks\" or \"near Shelby Park\"." },
  { pattern: /\bexclusive\b/i, explanation: NEIGHBORHOOD },
  { pattern: /\bmaster (bed ?room|bath(room)?|suite|closet)s?\b/i, explanation: "\"Master\" is widely replaced in listings.", suggestion: "Use \"primary\" instead, like \"primary bedroom\"." },
  { pattern: /\bmaster\b(?!-planned)/i, explanation: "\"Master\" is widely replaced in listings.", suggestion: "Use \"primary\" instead." },
];

export function checkFairHousing(text: string): FairHousingIssue[] {
  const issues: FairHousingIssue[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    for (const match of text.matchAll(new RegExp(rule.pattern.source, "gi"))) {
      const phrase = match[0];
      // Skip a bare "master" that was already caught as "master bedroom", and duplicate phrases.
      const key = phrase.toLowerCase();
      if (seen.has(key) || [...seen].some((s) => s.includes(key))) continue;
      seen.add(key);
      issues.push({ phrase, explanation: rule.explanation, suggestion: rule.suggestion });
    }
  }
  return issues;
}
