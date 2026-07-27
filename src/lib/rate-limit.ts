/**
 * Rate limiting for credential attempts — shared by admin login and member
 * onboarding verification.
 *
 * Attempts are an append-only log (`login_attempts` / `application_attempts`,
 * see `@/db/schema`) with no counter columns, so limiting works by counting
 * recent failure rows within a sliding window. The store is injected so the
 * window and threshold logic here stays pure and directly testable.
 *
 * ## Why the limit is keyed on (identifier + IP), not identifier alone
 *
 * An earlier version counted failures per identifier across *all* IPs. That
 * turned the defence into the attack: five failed logins against a known admin
 * address — sent from anywhere in the world, costing five requests every
 * fifteen minutes — locked that admin out of the app entirely, and the real
 * admin was refused from their own IP with the correct password. The same held
 * for members: five wrong guesses against a ledger number locked that member
 * out of onboarding.
 *
 * That matters more once the app's URL is public, which it becomes the moment
 * the onboarding link is circulated.
 *
 * Keying on the pair means an attacker can only lock out *themselves*. The
 * per-IP limit still stops one source spraying many accounts.
 *
 * The tradeoff is deliberate: a genuinely distributed brute force (many IPs,
 * one account) is slowed to 5 tries per IP per window rather than blocked
 * outright. Blocking it would mean reintroducing exactly the lockout above —
 * so it is surfaced as a signal for alerting (`distributedFailures`) instead,
 * which is the correct response to that pattern.
 */

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Failures for one identifier from one IP before that pair is blocked. */
export const IDENTIFIER_IP_FAILURE_LIMIT = 5;

/** Failures from one IP across all identifiers — stops account spraying. */
export const IP_FAILURE_LIMIT = 20;

/**
 * Cross-IP failures against a single identifier that indicate a distributed
 * attack. Deliberately **not** a blocking threshold — see the module note.
 */
export const DISTRIBUTED_ATTACK_SIGNAL = 25;

/** Generic, non-enumerating copy shown regardless of which limit tripped. */
export const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

export interface RateLimitStore {
  /**
   * `identifier+ip` counts failures for that exact pair; `ip` counts every
   * failure from the IP; `identifier` counts across all IPs and is used only
   * for the distributed-attack signal, never to block.
   */
  countRecentFailures(
    scope: "identifier+ip" | "ip" | "identifier",
    identifier: string,
    ip: string,
    since: Date,
  ): Promise<number>;
  recordAttempt(
    identifier: string | null,
    ip: string | null,
    success: boolean,
    now?: Date,
  ): Promise<void>;
}

export interface RateLimitResult {
  locked: boolean;
  /** Failures for this identifier from this IP. */
  pairFailures: number;
  /** Failures from this IP across all identifiers. */
  ipFailures: number;
  /** Failures against this identifier from all IPs — observability only. */
  distributedFailures: number;
  /** True when `distributedFailures` crosses the alerting threshold. */
  distributedAttackSuspected: boolean;
  message: string | null;
}

/**
 * Pure threshold check. Note `distributedFailures` is absent by design: it
 * must never contribute to blocking, or the third-party lockout returns.
 */
export function isLocked(pairFailures: number, ipFailures: number): boolean {
  return (
    pairFailures >= IDENTIFIER_IP_FAILURE_LIMIT || ipFailures >= IP_FAILURE_LIMIT
  );
}

export async function checkRateLimit(
  identifier: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const [pairFailures, ipFailures, distributedFailures] = await Promise.all([
    store.countRecentFailures("identifier+ip", identifier, ip, since),
    store.countRecentFailures("ip", identifier, ip, since),
    store.countRecentFailures("identifier", identifier, ip, since),
  ]);

  const locked = isLocked(pairFailures, ipFailures);
  return {
    locked,
    pairFailures,
    ipFailures,
    distributedFailures,
    distributedAttackSuspected: distributedFailures >= DISTRIBUTED_ATTACK_SIGNAL,
    message: locked ? RATE_LIMIT_MESSAGE : null,
  };
}

export async function recordFailure(
  identifier: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<void> {
  await store.recordAttempt(identifier, ip, false, now);
}

export async function clearFailures(
  identifier: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<void> {
  await store.recordAttempt(identifier, ip, true, now);
}
