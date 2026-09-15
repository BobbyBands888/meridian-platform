import "server-only";

/** Verifies a Cloudflare Turnstile token server-side. Tokens are single-use and expire after five minutes. */
export async function verifyTurnstile(token: string, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set; rejecting form submission.");
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("turnstile rejected", data["error-codes"]);
    return data.success === true;
  } catch (error) {
    console.error("turnstile verify failed", error);
    return false;
  }
}
