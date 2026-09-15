import { sendAlertDigests } from "@/lib/automation/buyer-alerts";
import { sendFounderDigest, type RunReport } from "@/lib/automation/founder-digest";
import { sendVendorLifecycleEmails } from "@/lib/automation/vendor-lifecycle";

// Vercel Hobby allows one run a day at an approximate time (vercel.json). Everything scheduled happens here.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily job: buyer alert digests (listings held back by the daily cap), vendor day-2/day-14 emails and the
 * monthly summary (on the 1st), then the founder digest, which reports on this run too. Each step is independent,
 * so one failing doesn't stop the rest.
 *
 * Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET". Outside production, ?now=2026-10-01T12:00:00Z
 * runs it as of another time, for testing the monthly summary and day-2/day-14 windows.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const override = new URL(request.url).searchParams.get("now");
  const now = override && process.env.VERCEL_ENV !== "production" && !Number.isNaN(Date.parse(override)) ? new Date(override) : new Date();

  const report: RunReport = { errors: [] };
  const step = async <T,>(name: string, run: () => Promise<T>) => {
    try {
      return await run();
    } catch (error) {
      const message = `${name}: ${error instanceof Error ? error.message : String(error)}`;
      console.error("daily job step failed", message);
      report.errors.push(message);
      return undefined;
    }
  };

  report.alertDigests = await step("Alert digests", sendAlertDigests);
  report.vendorEmails = await step("Vendor emails", () => sendVendorLifecycleEmails(now));
  const founderDigest = await step("Founder digest", () => sendFounderDigest(report, now));

  return Response.json({ now: now.toISOString(), ...report, founderDigest });
}
