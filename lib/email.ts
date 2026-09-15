import "server-only";
import { Resend } from "resend";
import { brandName, COMPANY, marketDisclaimer, marketUrl, type Market } from "@/lib/markets";

// Until a new market's domain is verified in Resend, its emails go out from this address (with the market's
// brand as the sender name and its own address as reply-to) instead of failing.
const FALLBACK_SENDER = "hello@nashvillebuys.com";

/** Resend accepts at most 100 emails per batch request. */
const BATCH_SIZE = 100;

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

export type EmailBlock =
  | { kind: "p"; text: string; link?: { label: string; href: string } }
  | { kind: "button"; label: string; href: string }
  | { kind: "quote"; text: string }
  | { kind: "rows"; rows: [string, string][] }
  | { kind: "heading"; text: string }
  /** Numbered or bulleted items; a title is shown in bold before the text. */
  | { kind: "list"; ordered?: boolean; items: { title?: string; text: string; href?: string }[] }
  /** A listing card: cover photo, price, specs, place, and a link. */
  | { kind: "listing"; href: string; imageUrl: string | null; imageAlt: string; price: string; specs: string; place: string };

/**
 * Marketing emails (buyer alerts, alert digests, vendor lifecycle emails) carry an unsubscribe link in the footer and
 * List-Unsubscribe headers, so Gmail and Apple Mail show their own one-click unsubscribe. Transactional emails don't.
 */
export type Unsubscribe = { url: string; oneClickUrl: string; label?: string };

export type EmailArgs = {
  /** The market the email is about: sets the sender, brand, footer, and disclaimer. */
  market: Market;
  to: string | string[];
  subject: string;
  heading: string;
  blocks: EmailBlock[];
  replyTo?: string;
  unsubscribe?: Unsubscribe;
  /** Resend idempotency key, so a retried send can't deliver twice. */
  idempotencyKey?: string;
};

const P = "margin:0 0 16px;font-size:16px;line-height:1.6;color:#111";
const LINK = "color:#1F4D3A;text-decoration:underline";

function renderBlockHtml(b: EmailBlock) {
  switch (b.kind) {
    case "p":
      return `<p style="${P}">${escapeHtml(b.text)}${b.link ? ` <a href="${escapeHtml(b.link.href)}" style="${LINK}">${escapeHtml(b.link.label)}</a>` : ""}</p>`;
    case "heading":
      return `<h2 style="margin:24px 0 8px;font-size:18px;line-height:1.35;color:#111">${escapeHtml(b.text)}</h2>`;
    case "quote":
      return `<div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #1F4D3A;background:#f6f6f4;font-size:16px;line-height:1.6;color:#111;white-space:pre-wrap">${escapeHtml(b.text)}</div>`;
    case "button":
      return `<p style="margin:24px 0"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:12px 20px;background:#1F4D3A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">${escapeHtml(b.label)}</a></p>`;
    case "rows":
      return `<table role="presentation" style="margin:0 0 16px;border-collapse:collapse;font-size:15px;line-height:1.5">${b.rows
        .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5b5f5d;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
        .join("")}</table>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items
        .map((item) => {
          const title = item.title ? `<strong>${escapeHtml(item.title)}</strong> ` : "";
          const text = item.href ? `<a href="${escapeHtml(item.href)}" style="${LINK}">${escapeHtml(item.text)}</a>` : escapeHtml(item.text);
          return `<li style="margin:0 0 10px">${title}${text}</li>`;
        })
        .join("");
      return `<${tag} style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.6;color:#111">${items}</${tag}>`;
    }
    case "listing":
      return `<table role="presentation" width="100%" style="margin:0 0 20px;border-collapse:separate;border:1px solid #e6e7e5;border-radius:12px;overflow:hidden">
<tr><td style="padding:0">${
        b.imageUrl
          ? `<a href="${escapeHtml(b.href)}"><img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.imageAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a>`
          : ""
      }</td></tr>
<tr><td style="padding:16px 18px">
<p style="margin:0;font-size:24px;font-weight:700;color:#111">${escapeHtml(b.price)}</p>
<p style="margin:4px 0 0;font-size:15px;color:#111">${escapeHtml(b.specs)}</p>
<p style="margin:2px 0 12px;font-size:15px;color:#5b5f5d">${escapeHtml(b.place)}</p>
<a href="${escapeHtml(b.href)}" style="display:inline-block;padding:10px 16px;background:#1F4D3A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">See the home</a>
</td></tr></table>`;
  }
}

function renderBlockText(b: EmailBlock) {
  switch (b.kind) {
    case "p":
      return b.link ? `${b.text} ${b.link.label}: ${b.link.href}` : b.text;
    case "heading":
      return b.text.toUpperCase();
    case "quote":
      return b.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "button":
      return `${b.label}: ${b.href}`;
    case "rows":
      return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "list":
      return b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : "-"} ${item.title ? `${item.title} ` : ""}${item.text}${item.href ? ` (${item.href})` : ""}`).join("\n");
    case "listing":
      return `${b.price}\n${b.specs}\n${b.place}\n${b.href}`;
  }
}

function renderHtml({ market, heading, blocks, unsubscribe }: EmailArgs) {
  const footer = [
    `<p style="margin:0;font-size:13px;line-height:1.6;color:#5b5f5d">${escapeHtml(marketDisclaimer(market))}</p>`,
    `<p style="margin:8px 0 0;font-size:13px;color:#5b5f5d">© 2026 ${escapeHtml(COMPANY.name)} · ${escapeHtml(market.name)}, ${escapeHtml(market.state_code)} · ${escapeHtml(market.sender_email)}</p>`,
    `<p style="margin:4px 0 0;font-size:13px;color:#5b5f5d">${escapeHtml(COMPANY.mailingAddress)}</p>`,
    unsubscribe
      ? `<p style="margin:8px 0 0;font-size:13px;color:#5b5f5d">${escapeHtml(unsubscribe.label ?? "Don't want these emails?")} <a href="${escapeHtml(unsubscribe.url)}" style="color:#5b5f5d;text-decoration:underline">Unsubscribe</a></p>`
      : "",
  ].join("\n");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1F4D3A">${escapeHtml(brandName(market))}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111">${escapeHtml(heading)}</h1>
${blocks.map(renderBlockHtml).join("\n")}
<hr style="margin:32px 0 16px;border:none;border-top:1px solid #e6e7e5">
${footer}
</div></body></html>`;
}

function renderText({ market, heading, blocks, unsubscribe }: EmailArgs) {
  const footer = [
    marketDisclaimer(market),
    `© 2026 ${COMPANY.name} · ${market.name}, ${market.state_code} · ${market.sender_email}`,
    COMPANY.mailingAddress,
    ...(unsubscribe ? [`Unsubscribe: ${unsubscribe.url}`] : []),
  ].join("\n");
  return `${heading}\n\n${blocks.map(renderBlockText).join("\n\n")}\n\n---\n${footer}`;
}

/** The rendered HTML for an email, for previews. */
export function renderEmailHtml(args: EmailArgs) {
  return renderHtml(args);
}

/** The Resend payload for one email, minus the sender (chosen at send time). */
function buildMessage(args: EmailArgs) {
  return {
    to: args.to,
    subject: args.subject,
    html: renderHtml(args),
    text: renderText(args),
    replyTo: args.replyTo,
    headers: args.unsubscribe
      ? { "List-Unsubscribe": `<${args.unsubscribe.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  };
}

const fromFor = (market: Market, sender = market.sender_email) => `${brandName(market)} <${sender}>`;
const unverified = (error: { message: string } | null) => Boolean(error && /domain is not verified/i.test(error.message));

/** Sends one email. Returns false (and logs) instead of throwing, so a mail outage never loses a submission. */
export async function sendEmail(args: EmailArgs): Promise<boolean> {
  return (await sendEmailWithId(args)).ok;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Like sendEmail, but returns Resend's email id (or the error) for logging. */
export async function sendEmailWithId(args: EmailArgs): Promise<SendResult> {
  const { market, subject, idempotencyKey } = args;
  const message = buildMessage(args);
  const options = idempotencyKey ? { idempotencyKey } : undefined;
  try {
    let { data, error } = await resend().emails.send({ ...message, from: fromFor(market) }, options);
    if (unverified(error) && market.sender_email !== FALLBACK_SENDER) {
      console.warn(`email: ${market.sender_email} isn't verified in Resend yet; sending from ${FALLBACK_SENDER}`);
      ({ data, error } = await resend().emails.send(
        { ...message, from: fromFor(market, FALLBACK_SENDER), replyTo: message.replyTo ?? market.sender_email },
        idempotencyKey ? { idempotencyKey: `${idempotencyKey}:fallback` } : undefined,
      ));
    }
    if (error || !data) {
      console.error("email send failed", subject, error?.name, error?.message);
      return { ok: false, error: error?.message ?? "No response from Resend" };
    }
    return { ok: true, id: data.id };
  } catch (error) {
    console.error("email send threw", subject, error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends many emails through Resend's batch API, 100 per request, and returns one result per email in order.
 * Emails in one call should share a market (they share the sender).
 */
export async function sendEmailBatch(emails: EmailArgs[], idempotencyKey?: string): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    const chunk = emails.slice(start, start + BATCH_SIZE);
    const market = chunk[0].market;
    const key = idempotencyKey ? `${idempotencyKey}:${start / BATCH_SIZE}` : undefined;
    const payload = (sender?: string) =>
      chunk.map((args) => {
        const message = buildMessage(args);
        return { ...message, from: fromFor(args.market, sender), replyTo: sender ? (message.replyTo ?? args.market.sender_email) : message.replyTo };
      });
    try {
      let { data, error } = await resend().batch.send(payload(), key ? { idempotencyKey: key } : undefined);
      if (unverified(error) && market.sender_email !== FALLBACK_SENDER) {
        console.warn(`email batch: ${market.sender_email} isn't verified in Resend yet; sending from ${FALLBACK_SENDER}`);
        ({ data, error } = await resend().batch.send(payload(FALLBACK_SENDER), key ? { idempotencyKey: `${key}:fallback` } : undefined));
      }
      if (error || !data) {
        console.error("email batch failed", chunk.length, error?.name, error?.message);
        results.push(...chunk.map((): SendResult => ({ ok: false, error: error?.message ?? "No response from Resend" })));
        continue;
      }
      results.push(...chunk.map((_, i): SendResult => (data.data[i] ? { ok: true, id: data.data[i].id } : { ok: false, error: "Missing from batch response" })));
    } catch (error) {
      console.error("email batch threw", error);
      results.push(...chunk.map((): SendResult => ({ ok: false, error: error instanceof Error ? error.message : String(error) })));
    }
  }
  return results;
}
