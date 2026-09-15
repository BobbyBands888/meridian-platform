import "server-only";
import { areaForZip } from "@/lib/areas";
import { sendEmail, siteLink } from "@/lib/email";
import { brandName, type Market } from "@/lib/markets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isAlertToken = (token: unknown): token is string => typeof token === "string" && UUID.test(token);

export const unsubscribePath = (token: string) => `/alerts/unsubscribe?token=${token}`;

/**
 * Every alert email carries the unsubscribe link in the body and in List-Unsubscribe headers. The headers let Gmail
 * and Apple Mail show their own unsubscribe button, which POSTs to the one-click endpoint (RFC 8058).
 */
function unsubscribeHeaders(market: Market, token: string) {
  return {
    "List-Unsubscribe": `<${siteLink(market, `/alerts/unsubscribe/one-click?token=${token}`)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function alertAreaLabel(market: Market, zip: string | null) {
  if (!zip) return null;
  const area = areaForZip(market, zip);
  return area ? `${zip} (${area})` : zip;
}

export function sendAlertConfirmation(market: Market, { email, zip, token }: { email: string; zip: string | null; token: string }) {
  const area = alertAreaLabel(market, zip);
  const brand = brandName(market);
  return sendEmail({
    market,
    marketing: true,
    to: email,
    subject: `You're signed up for ${brand} listing alerts`,
    heading: "You're on the list",
    headers: unsubscribeHeaders(market, token),
    blocks: [
      {
        kind: "p",
        text: area
          ? `We'll email you when new for-sale-by-owner homes are listed on ${brand}, starting with ZIP ${area}.`
          : `We'll email you when new for-sale-by-owner homes are listed on ${brand} across ${market.name} and ${market.region}.`,
      },
      market.status === "live"
        ? { kind: "button", label: "Browse homes now", href: siteLink(market, zip ? `/homes?zip=${zip}` : "/homes") }
        : { kind: "p", text: `${brand} is launching soon. You'll hear from us when the first homes are listed.` },
      {
        kind: "p",
        text: "Every home is listed by its owner, and you contact sellers directly.",
      },
      {
        kind: "p",
        text: "Didn't sign up, or changed your mind?",
        link: { label: "Unsubscribe", href: siteLink(market, unsubscribePath(token)) },
      },
    ],
  });
}
