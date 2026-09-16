import "server-only";
import { getChecklist, type ChecklistSection } from "@/lib/checklist";
import type { CourseSignup, VendorCategoryValue } from "@/lib/database.types";
import { sendEmailWithId, siteLink, type EmailBlock, type Unsubscribe } from "@/lib/email";
import { getGuides, type GuideMeta } from "@/lib/guides";
import { brandName, type Market } from "@/lib/markets";
import { getActiveVendorCategories } from "@/lib/public-vendors";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByValue } from "@/lib/vendors";

/**
 * "Selling without an agent in Nashville, one email a day for a week." Each day is one section of the pre-sale
 * checklist, with a link to the matching guide and to the vendors that section's steps call for.
 *
 * Day 1 goes out as soon as someone signs up, so the signup confirms itself; the daily job sends days 2 through 7.
 * Anyone who has listed a home is dropped from the course: they're past it.
 */

export const COURSE_DAYS = 7;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCourseToken = (token: unknown): token is string => typeof token === "string" && UUID.test(token);

export const courseUnsubscribePath = (token: string) => `/sell/course/unsubscribe?token=${token}`;

export function courseUnsubscribe(market: Market, token: string): Unsubscribe {
  return {
    url: siteLink(market, courseUnsubscribePath(token)),
    oneClickUrl: siteLink(market, `/sell/course/unsubscribe/one-click?token=${token}`),
    label: "You're getting this because you signed up for the seven-day seller course.",
  };
}

/** A one-line promise for each day, above that section's steps. */
const dayIntros = [
  "Before anything else, work out your number and what the market says your home is worth.",
  "A week of work on the house is worth more than any marketing you could buy.",
  "Get the paperwork ready now, so an interested buyer never has to wait on you.",
  "Your listing is live. Here's how to handle photos, showings, and the people who turn up.",
  "An offer arrived. Here's how to read it and turn it into a signed contract.",
  "Under contract is where deals fall apart. These are the dates and the traps.",
  "The last stretch: the walk-through, the closing table, and what to keep afterwards.",
];

/** Slug fragments that point a day at the guide it should link to, most specific first. */
const dayGuideHints: string[][] = [
  ["price", "pricing"],
  ["how-to-sell", "sell-your-house", "sell-your-home"],
  ["disclosure"],
  ["showing", "safety"],
  ["attorney", "title"],
  ["attorney", "title"],
  ["attorney", "title", "closing"],
];

/** The market's overview guide, used when a day has no closer match. */
const OVERVIEW = /how-to-sell|sell-your-house|sell-your-home|without-an-agent/;

function guideForDay(day: number, guides: GuideMeta[]): GuideMeta | null {
  const hints = dayGuideHints[day - 1] ?? [];
  for (const hint of hints) {
    const match = guides.find((g) => g.slug.includes(hint));
    if (match) return match;
  }
  return guides.find((g) => OVERVIEW.test(g.slug)) ?? guides[0] ?? null;
}

function categoryForSection(section: ChecklistSection, active: VendorCategoryValue[]): VendorCategoryValue | null {
  const mentioned = section.steps.flatMap((step) => step.categories);
  return mentioned.find((c) => active.includes(c)) ?? null;
}

export type Lesson = { day: number; subject: string; heading: string; blocks: EmailBlock[] };

/** Builds one day's email for a market. Returns null when the checklist has no section for that day. */
export async function buildLesson(market: Market, day: number): Promise<Lesson | null> {
  if (day < 1 || day > COURSE_DAYS) return null;
  const [checklist, guides, activeCategories] = await Promise.all([
    getChecklist(market),
    getGuides(market.slug),
    getActiveVendorCategories(market.id).catch(() => []),
  ]);
  const section = checklist.sections[day - 1];
  if (!section) return null;

  const brand = brandName(market);
  const guide = guideForDay(day, guides);
  const category = categoryForSection(section, activeCategories.map((c) => c.value));
  const firstStep = section.steps[0]?.number;

  const blocks: EmailBlock[] = [
    { kind: "p", text: dayIntros[day - 1] ?? "" },
    {
      kind: "list",
      ordered: true,
      items: section.steps.map((step) => ({ title: step.title, text: step.body })),
    },
    {
      kind: "button",
      label: "Tick these off on the checklist",
      href: siteLink(market, firstStep ? `/sell/checklist#step-${firstStep}` : "/sell/checklist"),
    },
  ];

  if (guide) {
    blocks.push({ kind: "p", text: `More on this:`, link: { label: guide.title, href: siteLink(market, `/guides/${guide.slug}`) } });
  }
  if (category) {
    const info = categoryByValue(category);
    blocks.push({
      kind: "p",
      text: `Need a hand with this part?`,
      link: { label: `${brand} ${info.label.toLowerCase()}`, href: siteLink(market, `/vendors/${info.slug}`) },
    });
  }
  if (day === COURSE_DAYS) {
    blocks.push({ kind: "p", text: "That's the week. When you're ready, listing on " + brand + " is free.", link: { label: "List your home", href: siteLink(market, "/sell") } });
  }

  return {
    day,
    subject: `Day ${day} of ${COURSE_DAYS}: ${section.title}`,
    heading: section.title,
    blocks,
  };
}

/** True when an account with this address already has a listing, in any market and any status. */
export async function hasListedAHome(email: string) {
  const { data, error } = await createAdminClient()
    .from("listings")
    .select("id, profiles!inner(email)")
    .eq("profiles.email", email)
    .limit(1);
  if (error) {
    console.error("course: listing check failed", error.code, error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Signs an address up for the course (or picks a returning subscriber back up) and sends day 1 right away. Someone
 * who already has a listing is past the course, so they're recorded as finished and sent nothing. False on a
 * database error.
 */
export async function enrollInCourse(market: Market, email: string, source: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("course_signups")
    .select("id, next_day, unsubscribe_token, unsubscribed_at, completed_at, last_sent_at")
    .eq("market_id", market.id)
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("course signup lookup failed", lookupError.code, lookupError.message);
    return false;
  }

  const listed = await hasListedAHome(email);

  let signup = existing;
  if (!existing) {
    const { data, error } = await admin
      .from("course_signups")
      .insert({ email, market_id: market.id, source, ...(listed ? { completed_at: new Date().toISOString() } : {}) })
      .select("id, next_day, unsubscribe_token, unsubscribed_at, completed_at, last_sent_at")
      .single();
    if (error && error.code !== "23505") {
      console.error("course signup insert failed", error.code, error.message);
      return false;
    }
    signup = data ?? null; // 23505: a simultaneous submit already saved it.
  } else if (existing.unsubscribed_at && !existing.completed_at) {
    // Someone coming back picks up where they left off.
    const { error } = await admin.from("course_signups").update({ unsubscribed_at: null }).eq("id", existing.id);
    if (error) console.error("course resubscribe failed", error.code, error.message);
  }

  // Day 1 goes out now, so the signup confirms itself. The daily job takes over from day 2.
  if (signup && !listed && !signup.completed_at && !signup.last_sent_at) {
    await sendNextLesson({ ...signup, email, market_id: market.id }, market);
  }
  return true;
}

type Signup = Pick<CourseSignup, "id" | "email" | "market_id" | "next_day" | "unsubscribe_token">;

export type CourseSendResult = { sent: number; skipped: number; failed: number; completed: number };

/**
 * Sends one subscriber their next lesson and advances their progress. The course_emails row is claimed first, so
 * two overlapping runs can't send the same day twice.
 */
export async function sendNextLesson(signup: Signup, market: Market): Promise<"sent" | "skipped" | "failed" | "done"> {
  const admin = createAdminClient();
  const day = signup.next_day;
  if (day > COURSE_DAYS) {
    await admin.from("course_signups").update({ completed_at: new Date().toISOString() }).eq("id", signup.id);
    return "done";
  }

  if (await hasListedAHome(signup.email)) {
    await admin.from("course_emails").insert({ signup_id: signup.id, day, status: "skipped" });
    await admin.from("course_signups").update({ completed_at: new Date().toISOString() }).eq("id", signup.id);
    return "skipped";
  }

  const { data: claim, error: claimError } = await admin
    .from("course_emails")
    .insert({ signup_id: signup.id, day, status: "sending" })
    .select("id")
    .single();
  // 23505: another run already claimed this day.
  if (claimError || !claim) {
    if (claimError?.code !== "23505") console.error("course: claim failed", claimError?.code, claimError?.message);
    return "skipped";
  }

  const lesson = await buildLesson(market, day);
  if (!lesson) {
    await admin.from("course_emails").update({ status: "skipped", error: "No checklist section for this day" }).eq("id", claim.id);
    await admin.from("course_signups").update({ completed_at: new Date().toISOString() }).eq("id", signup.id);
    return "skipped";
  }

  const result = await sendEmailWithId({
    market,
    to: signup.email,
    subject: lesson.subject,
    heading: lesson.heading,
    blocks: lesson.blocks,
    unsubscribe: courseUnsubscribe(market, signup.unsubscribe_token),
    idempotencyKey: `course:${signup.id}:${day}`,
  });

  const now = new Date().toISOString();
  if (!result.ok) {
    await admin.from("course_emails").update({ status: "failed", error: result.error }).eq("id", claim.id);
    return "failed";
  }

  await admin.from("course_emails").update({ status: "sent", resend_id: result.id, sent_at: now }).eq("id", claim.id);
  await admin
    .from("course_signups")
    .update({ next_day: day + 1, last_sent_at: now, completed_at: day + 1 > COURSE_DAYS ? now : null })
    .eq("id", signup.id);
  return "sent";
}

/**
 * The daily job's step: one lesson each to everyone whose last one went out more than 20 hours ago. Twenty rather
 * than twenty-four so a cron that drifts later in the day never skips someone.
 */
export async function sendCourseEmails(markets: Market[], now = new Date()): Promise<CourseSendResult> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
  const byId = new Map(markets.map((m) => [m.id, m]));

  const { data: due, error } = await admin
    .from("course_signups")
    .select("id, email, market_id, next_day, unsubscribe_token")
    .is("unsubscribed_at", null)
    .is("completed_at", null)
    // Null covers a signup whose day-1 send failed, so they still get picked up.
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`)
    .order("last_sent_at", { nullsFirst: true })
    .limit(500);
  if (error) throw new Error(`course signups query failed: ${error.message}`);

  const result: CourseSendResult = { sent: 0, skipped: 0, failed: 0, completed: 0 };
  for (const signup of due ?? []) {
    const market = byId.get(signup.market_id);
    if (!market) continue;
    const outcome = await sendNextLesson(signup, market);
    if (outcome === "sent") {
      result.sent += 1;
      if (signup.next_day + 1 > COURSE_DAYS) result.completed += 1;
    } else if (outcome === "failed") result.failed += 1;
    else result.skipped += 1;
  }
  return result;
}
