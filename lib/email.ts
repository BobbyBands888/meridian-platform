import "server-only";
import { Resend } from "resend";
import { brandName, COMPANY, marketDisclaimer, marketUrl, type Market } from "@/lib/markets";

// Until a new market's domain is verified in Resend, its emails go out from this address (with the market's
// brand as the sender name and its own address as reply-to) instead of failing.
const FALLBACK_SENDER = "hello@nashvillebuys.com";

let client: Resend | null = null;
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  client ??= new Resend(key);
  return client;
}

export function adminEmail() {
  return process.env.ADMIN_EMAIL || FALLBACK_SENDER;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Absolute URL on a market's site, for links inside emails. */
export function siteLink(market: Pick<Market, "domain">, path: string) {
  return marketUrl(market, path);
}

type EmailBlock = { kind: "p"; text: string; link?: { label: string; href: string } } | { kind: "button"; label: string; href: string } | { kind: "quote"; text: string } | { kind: "rows"; rows: [string, string][] };

type SendArgs = {
  /** The market the email is about: sets the sender, brand, footer, and disclaimer. */
  market: Market;
  /** Marketing email (alerts, digests, pre-launch confirmations): the footer includes the postal address. */
  marketing?: boolean;
  to: string | string[];
  subject: string;
  heading: string;
  blocks: EmailBlock[];
  replyTo?: string;
  headers?: Record<string, string>;
};

function renderHtml(market: Market, heading: string, blocks: EmailBlock[], marketing: boolean) {
  const body = blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#111">${escapeHtml(b.text)}${
            b.link ? ` <a href="${escapeHtml(b.link.href)}" style="color:#1F4D3A;text-decoration:underline">${escapeHtml(b.link.label)}</a>` : ""
          }</p>`;
        case "quote":
          return `<div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #1F4D3A;background:#f6f6f4;font-size:16px;line-height:1.6;color:#111;white-space:pre-wrap">${escapeHtml(b.text)}</div>`;
        case "button":
          return `<p style="margin:24px 0"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:12px 20px;background:#1F4D3A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">${escapeHtml(b.label)}</a></p>`;
        case "rows":
          return `<table role="presentation" style="margin:0 0 16px;border-collapse:collapse;font-size:15px;line-height:1.5">${b.rows
            .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5b5f5d;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
            .join("")}</table>`;
      }
    })
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1F4D3A">${escapeHtml(brandName(market))}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111">${escapeHtml(heading)}</h1>
${body}
<hr style="margin:32px 0 16px;border:none;border-top:1px solid #e6e7e5">
<p style="margin:0;font-size:13px;line-height:1.6;color:#5b5f5d">${escapeHtml(marketDisclaimer(market))}</p>
<p style="margin:8px 0 0;font-size:13px;color:#5b5f5d">© 2026 ${escapeHtml(COMPANY.name)} · ${escapeHtml(market.name)}, ${escapeHtml(market.state_code)} · ${escapeHtml(market.sender_email)}</p>${
    marketing ? `\n<p style="margin:4px 0 0;font-size:13px;color:#5b5f5d">${escapeHtml(COMPANY.mailingAddress)}</p>` : ""
  }
</div></body></html>`;
}

function renderText(market: Market, heading: string, blocks: EmailBlock[], marketing: boolean) {
  const body = blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return b.link ? `${b.text} ${b.link.label}: ${b.link.href}` : b.text;
        case "quote":
          return b.text
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "button":
          return `${b.label}: ${b.href}`;
        case "rows":
          return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    })
    .join("\n\n");
  return `${heading}\n\n${body}\n\n---\n${marketDisclaimer(market)}\n© 2026 ${COMPANY.name} · ${market.name}, ${market.state_code} · ${market.sender_email}${marketing ? `\n${COMPANY.mailingAddress}` : ""}`;
}

/** Sends one transactional email. Returns false (and logs) instead of throwing, so a mail outage never loses a submission. */
export async function sendEmail({ market, marketing = false, to, subject, heading, blocks, replyTo, headers }: SendArgs): Promise<boolean> {
  const brand = brandName(market);
  const message = { to, subject, html: renderHtml(market, heading, blocks, marketing), text: renderText(market, heading, blocks, marketing), headers };
  try {
    let { error } = await resend().emails.send({ ...message, from: `${brand} <${market.sender_email}>`, replyTo });
    if (error && /domain is not verified/i.test(error.message) && market.sender_email !== FALLBACK_SENDER) {
      console.warn(`email: ${market.sender_email} isn't verified in Resend yet; sending from ${FALLBACK_SENDER}`);
      ({ error } = await resend().emails.send({ ...message, from: `${brand} <${FALLBACK_SENDER}>`, replyTo: replyTo ?? market.sender_email }));
    }
    if (error) {
      console.error("email send failed", subject, error.name, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("email send threw", subject, error);
    return false;
  }
}
