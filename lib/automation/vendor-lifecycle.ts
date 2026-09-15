import "server-only";
import type { VendorEmailKind } from "@/lib/database.types";
import { adminEmail, sendEmailWithId, siteLink, type EmailArgs, type EmailBlock, type Unsubscribe } from "@/lib/email";
import { getMarkets } from "@/lib/market-data";
import { brandName, isLive, type Market } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendorEmailsPath } from "@/lib/vendor-email-prefs";
import { daysAgo, localDayOfMonth, previousMonth } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

// One-time emails go out once a vendor is this many days in, within a week-long window. The window keeps a missed
// daily run from skipping an email, and keeps long-standing vendors from getting "day 2" out of the blue.
const WINDOWS: Record<"day2" | "day14", [number, number]> = { day2: [2, 7], day14: [14, 21] };

/** The monthly summary goes out on the 1st; the 2nd and 3rd catch up if a daily run was missed. */
const MONTHLY_CATCH_UP_DAYS = 3;

/** Vendors approved (or launched) within this many days of the 1st skip that month's summary. */
const MONTHLY_MIN_DAYS = 3;

const INQUIRY_LIST_MAX = 25;

export type LifecycleVendor = {
  id: string;
  business_name: string;
  market_id: string;
  approved_at: string | null;
  email_token: string;
  profiles: { email: string; full_name: string | null };
};

export type LifecycleSummary = { day2: number; day14: number; monthly: number; failed: number };

export function vendorEmailsUnsubscribe(market: Market, token: string): Unsubscribe {
  return {
    url: siteLink(market, vendorEmailsPath(token)),
    oneClickUrl: siteLink(market, `/vendors/emails/one-click?token=${token}`),
    label: "Tips and monthly summaries for vendors. Approval and inquiry emails still come through.",
  };
}

const firstName = (vendor: LifecycleVendor) => vendor.profiles.full_name?.split(" ")[0] ?? null;
const greeting = (vendor: LifecycleVendor): EmailBlock => ({ kind: "p", text: firstName(vendor) ? `Hi ${firstName(vendor)},` : "Hi," });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function tips(market: Market): EmailBlock {
  const dashboard = siteLink(market, "/dashboard/vendor");
  const edit = siteLink(market, "/dashboard/vendor/edit");
  return {
    kind: "list",
    ordered: true,
    items: [
      { title: "Show a recent job.", text: "Swap in a photo of recent work, or add a line about a recent project to your bio.", href: edit },
      { title: "Set a clear price range.", text: "People contact pros whose pricing they can picture. Give a starting price or a typical range.", href: edit },
      { title: "Get the Verified badge.", text: "Send your license number and insurance certificate from your dashboard. Verified vendors are listed first.", href: dashboard },
    ],
  };
}

export function day2Email(market: Market, vendor: LifecycleVendor): EmailArgs {
  return {
    market,
    to: vendor.profiles.email,
    subject: "Three things that get your profile picked",
    heading: "Three things that get your profile picked",
    blocks: [
      greeting(vendor),
      { kind: "p", text: `${vendor.business_name} is live on ${brandName(market)}. Buyers and sellers compare a few pros before they reach out. These three changes make the difference:` },
      tips(market),
      { kind: "button", label: "Open your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
    ],
    unsubscribe: vendorEmailsUnsubscribe(market, vendor.email_token),
  };
}

export function day14Email(market: Market, vendor: LifecycleVendor, inquiries: number): EmailArgs {
  return {
    market,
    to: vendor.profiles.email,
    replyTo: adminEmail(),
    subject: "How's it going?",
    heading: "How's it going?",
    blocks: [
      greeting(vendor),
      {
        kind: "p",
        text:
          inquiries > 0
            ? `${vendor.business_name} has been on ${brandName(market)} for two weeks and has received ${plural(inquiries, "inquiry", "inquiries")} so far.`
            : `${vendor.business_name} has been on ${brandName(market)} for two weeks. You haven't received an inquiry yet, which is normal this early.`,
      },
      { kind: "p", text: "Is the directory working for you? Anything confusing, missing, or annoying? Just reply to this email. Replies come straight to me, and I read every one." },
      { kind: "p", text: "Thanks for being one of our founding vendors." },
      { kind: "p", text: brandName(market) },
    ],
    unsubscribe: vendorEmailsUnsubscribe(market, vendor.email_token),
  };
}

export type Inquiry = { sender_name: string; sender_email: string; created_at: string };

export function monthlyEmail(market: Market, vendor: LifecycleVendor, month: { name: string }, inquiries: Inquiry[]): EmailArgs {
  const brand = brandName(market);
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: market.timezone });
  if (inquiries.length === 0) {
    return {
      market,
      to: vendor.profiles.email,
      subject: "Here's how to get your first inquiry",
      heading: "Here's how to get your first inquiry",
      blocks: [
        greeting(vendor),
        { kind: "p", text: `${vendor.business_name} didn't receive an inquiry through ${brand} in ${month.name}. These three changes help the most:` },
        tips(market),
        { kind: "button", label: "Open your vendor dashboard", href: siteLink(market, "/dashboard/vendor") },
      ],
      unsubscribe: vendorEmailsUnsubscribe(market, vendor.email_token),
    };
  }
  const shown = inquiries.slice(0, INQUIRY_LIST_MAX);
  const headline = `You received ${plural(inquiries.length, "inquiry", "inquiries")} through ${brand} in ${month.name}`;
  return {
    market,
    to: vendor.profiles.email,
    subject: headline,
    heading: headline,
    blocks: [
      greeting(vendor),
      { kind: "p", text: `Here's who reached out to ${vendor.business_name}:` },
      { kind: "list", items: shown.map((i) => ({ title: `${dateFmt.format(new Date(i.created_at))}:`, text: `${i.sender_name} (${i.sender_email})` })) },
      ...(inquiries.length > shown.length ? [{ kind: "p" as const, text: `And ${inquiries.length - shown.length} more.` }] : []),
      { kind: "button", label: "See them in your dashboard", href: siteLink(market, "/dashboard/vendor") },
    ],
    unsubscribe: vendorEmailsUnsubscribe(market, vendor.email_token),
  };
}

/** Claims a (vendor, kind, period) row, sends, and records the result. Returns false when it was already sent. */
async function sendOnce(vendorId: string, kind: VendorEmailKind, period: string, build: () => Promise<EmailArgs>) {
  const admin = createAdminClient();
  const { data: claim, error } = await admin
    .from("vendor_emails")
    .upsert({ vendor_id: vendorId, kind, period, status: "sending" }, { onConflict: "vendor_id,kind,period", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`Could not record vendor email: ${error.message}`);
  if (claim.length === 0) return null;
  const result = await sendEmailWithId({ ...(await build()), idempotencyKey: `vendor-email:${claim[0].id}` });
  await admin
    .from("vendor_emails")
    .update(result.ok ? { status: "sent", resend_id: result.id, sent_at: new Date().toISOString() } : { status: "failed", error: result.error.slice(0, 1000) })
    .eq("id", claim[0].id);
  return result.ok;
}

/**
 * Day-2 tips, the day-14 check-in, and (on the 1st) last month's inquiry summary, for approved vendors in live
 * markets who haven't unsubscribed. A pre-launch vendor's clock starts when their market launches.
 */
export async function sendVendorLifecycleEmails(now = new Date()): Promise<LifecycleSummary> {
  const admin = createAdminClient();
  const summary: LifecycleSummary = { day2: 0, day14: 0, monthly: 0, failed: 0 };
  const live = (await getMarkets()).filter((m) => isLive(m));

  for (const market of live) {
    const launched = market.launched_at ? Date.parse(market.launched_at) : 0;
    const { data: vendors, error } = await admin
      .from("vendors")
      .select("id, business_name, market_id, approved_at, email_token, profiles!inner(email, full_name)")
      .eq("market_id", market.id)
      .eq("status", "approved")
      .is("lifecycle_unsubscribed_at", null)
      .not("approved_at", "is", null);
    if (error) throw new Error(`Could not load vendors: ${error.message}`);

    const record = (kind: keyof LifecycleSummary, ok: boolean | null) => {
      if (ok === true) summary[kind] += 1;
      if (ok === false) summary.failed += 1;
    };

    for (const vendor of vendors as LifecycleVendor[]) {
      const start = Math.max(Date.parse(vendor.approved_at!), launched);
      const ageDays = (now.getTime() - start) / DAY_MS;

      for (const kind of ["day2", "day14"] as const) {
        const [from, to] = WINDOWS[kind];
        if (ageDays < from || ageDays >= to) continue;
        const ok = await sendOnce(vendor.id, kind, "", async () => {
          if (kind === "day2") return day2Email(market, vendor);
          const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("type", "vendor").eq("target_id", vendor.id);
          return day14Email(market, vendor, count ?? 0);
        });
        record(kind, ok);
      }

      if (localDayOfMonth(market.timezone, now) <= MONTHLY_CATCH_UP_DAYS) {
        const month = previousMonth(market.timezone, now);
        if (start > daysAgo(MONTHLY_MIN_DAYS, month.end).getTime()) continue;
        const ok = await sendOnce(vendor.id, "monthly", month.period, async () => {
          const { data: inquiries } = await admin
            .from("leads")
            .select("sender_name, sender_email, created_at")
            .eq("type", "vendor")
            .eq("target_id", vendor.id)
            .gte("created_at", month.start.toISOString())
            .lt("created_at", month.end.toISOString())
            .order("created_at");
          return monthlyEmail(market, vendor, month, inquiries ?? []);
        });
        record("monthly", ok);
      }
    }
  }
  return summary;
}
