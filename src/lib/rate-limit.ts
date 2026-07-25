/**
 * Rate limiting for login attempts. `login_attempts` (see `@/db/schema`) is
 * an append-only log — no counter columns — so limiting works by counting
 * recent failure rows within a sliding window, injected via `RateLimitStore`
 * so the window/backoff logic here stays pure and unit-testable without a
 * database.
 */

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_FAILURE_LIMIT = 5;
export const IP_FAILURE_LIMIT = 20;

/** Generic, non-enumerating copy shown regardless of which limit tripped. */
export const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

export interface RateLimitStore {
  countRecentFailures(
    field: "email" | "ip",
    value: string,
    since: Date,
  ): Promise<number>;
  recordAttempt(
    email: string | null,
    ip: string | null,
    success: boolean,
    now?: Date,
  ): Promise<void>;
}

export interface RateLimitResult {
  locked: boolean;
  emailFailures: number;
  ipFailures: number;
  message: string | null;
}

/** Pure threshold check: locked once either failure count hits its limit. */
export function isLocked(emailFailures: number, ipFailures: number): boolean {
  return (
    emailFailures >= EMAIL_FAILURE_LIMIT || ipFailures >= IP_FAILURE_LIMIT
  );
}

export async function checkRateLimit(
  email: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const [emailFailures, ipFailures] = await Promise.all([
    store.countRecentFailures("email", email, since),
    store.countRecentFailures("ip", ip, since),
  ]);
  const locked = isLocked(emailFailures, ipFailures);
  return {
    locked,
    emailFailures,
    ipFailures,
    message: locked ? RATE_LIMIT_MESSAGE : null,
  };
}

export async function recordFailure(
  email: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<void> {
  await store.recordAttempt(email, ip, false, now);
}

export async function clearFailures(
  email: string,
  ip: string,
  store: RateLimitStore,
  now: Date = new Date(),
): Promise<void> {
  await store.recordAttempt(email, ip, true, now);
}
