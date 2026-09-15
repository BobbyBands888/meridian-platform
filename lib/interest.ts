import type { Json } from "@/lib/database.types";
import { formatPrice } from "@/lib/listings";

/**
 * Expressions of interest: a buyer's asking price, financing, and timing, saved on a lead of type "interest".
 * It is not an offer, and nothing here creates one. This module is shared by the form, the action, and the
 * dashboard, so the wording and the field names stay in one place.
 */

export const INTEREST_DISCLAIMER =
  "This is an expression of interest, not an offer. Formal offers go through your attorney on a purchase agreement.";

export const financingOptions = [
  { value: "cash", label: "Cash" },
  { value: "conventional", label: "Conventional" },
  { value: "fha", label: "FHA" },
  { value: "va", label: "VA" },
  { value: "other", label: "Other" },
] as const;

export type Financing = (typeof financingOptions)[number]["value"];

export type InterestDetails = {
  offer_amount: number;
  financing: Financing;
  pre_approved: boolean;
  /** Calendar date, YYYY-MM-DD. */
  target_close: string;
};

export const financingLabel = (value: Financing) => financingOptions.find((o) => o.value === value)?.label ?? "Other";

/** Cash buyers aren't borrowing, so pre-approval doesn't apply to them. */
export const needsLender = (details: Pick<InterestDetails, "financing" | "pre_approved">) =>
  details.financing !== "cash" && !details.pre_approved;

const isFinancing = (value: unknown): value is Financing => financingOptions.some((o) => o.value === value);

/** Reads details back off a lead row, which is untyped jsonb. Returns null when it isn't the shape we wrote. */
export function readInterestDetails(value: Json | null): InterestDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { offer_amount, financing, pre_approved, target_close } = value as Record<string, unknown>;
  if (typeof offer_amount !== "number" || !isFinancing(financing)) return null;
  if (typeof pre_approved !== "boolean" || typeof target_close !== "string") return null;
  return { offer_amount, financing, pre_approved, target_close };
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "November 15, 2026" from a plain calendar date, read as UTC so it never shifts a day. */
export const formatTargetClose = (date: string) => dateFmt.format(new Date(`${date}T12:00:00Z`));

/** The label/value pairs shown in the seller's email and on their dashboard, in one order. */
export function interestRows(details: InterestDetails): [string, string][] {
  return [
    ["Amount", formatPrice(details.offer_amount)],
    ["Financing", financingLabel(details.financing)],
    ["Pre-approved", details.financing === "cash" ? "Paying cash" : details.pre_approved ? "Yes" : "Not yet"],
    ["Hoping to close", formatTargetClose(details.target_close)],
  ];
}

/** The furthest out a target closing date may be, so the field can't be used to store nonsense. */
export const MAX_CLOSE_DAYS = 730;

/** The bounds for the date field, as plain calendar dates in UTC. Worked out per request, not during render. */
export function closeDateRange() {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return { min: new Date(now).toISOString().slice(0, 10), max: new Date(now + MAX_CLOSE_DAYS * day).toISOString().slice(0, 10) };
}
