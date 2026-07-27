import "server-only";

/**
 * Cloudflare Turnstile verification.
 *
 * Works on Vercel — Turnstile is not tied to Cloudflare hosting. The widget
 * loads from `challenges.cloudflare.com` and verification is a plain POST to
 * their `siteverify` endpoint; neither requires traffic to be proxied through
 * Cloudflare.
 *
 * ## Optional by design
 *
 * When `TURNSTILE_SECRET_KEY` is unset, verification is skipped and every
 * check passes. That is deliberate, not an oversight:
 *
 * - It keeps local development and CI working without secrets.
 * - More importantly, it makes Turnstile a switch MDPVA can throw. This form
 *   is aimed at members with limited digital literacy on old Android phones,
 *   and every extra hurdle is a phone call to the office or a member giving
 *   up. If the challenge causes trouble during rollout, staff can unset the
 *   key and the flow keeps working rather than needing a redeploy of changed
 *   code.
 *
 * The consequence is that a missing key silently disables a security control,
 * so `isTurnstileConfigured` is exported for a startup/health check to assert
 * against in production.
 */

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export interface TurnstileResult {
  ok: boolean;
  /** True when the check was skipped because no key is configured. */
  skipped: boolean;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (!token) return { ok: false, skipped: false };

  const body = new URLSearchParams({ secret, response: token });
  // Cloudflare treats remoteip as optional; sending it tightens the check but
  // must be omitted when we only have a placeholder.
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // Never let a Cloudflare outage hang a login request indefinitely.
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return { ok: data.success === true, skipped: false };
  } catch {
    /*
     * Fail closed. An attacker who can make this request fail — by exhausting
     * their own network, or during a Cloudflare incident — would otherwise
     * bypass the check entirely, which is the one thing it exists to stop.
     *
     * The cost is that a Cloudflare outage blocks logins. That is survivable:
     * unsetting TURNSTILE_SECRET_KEY restores access immediately, and it is
     * the reason the key is treated as a runtime switch rather than baked in.
     */
    return { ok: false, skipped: false };
  }
}
