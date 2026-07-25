import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  clearFailures,
  EMAIL_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  isLocked,
  RATE_LIMIT_WINDOW_MS,
  recordFailure,
  type RateLimitStore,
} from "@/lib/rate-limit";

type Attempt = {
  email: string | null;
  ip: string | null;
  success: boolean;
  createdAt: number;
};

function createInMemoryStore(attempts: Attempt[] = []): RateLimitStore {
  return {
    async countRecentFailures(field, value, since) {
      return attempts.filter(
        (a) =>
          a[field] === value && !a.success && a.createdAt >= since.getTime(),
      ).length;
    },
    async recordAttempt(email, ip, success, now = new Date()) {
      attempts.push({ email, ip, success, createdAt: now.getTime() });
    },
  };
}

describe("isLocked", () => {
  it("is not locked below both thresholds", () => {
    expect(isLocked(0, 0)).toBe(false);
    expect(isLocked(EMAIL_FAILURE_LIMIT - 1, IP_FAILURE_LIMIT - 1)).toBe(
      false,
    );
  });

  it("locks once email failures hit the limit", () => {
    expect(isLocked(EMAIL_FAILURE_LIMIT, 0)).toBe(true);
  });

  it("locks once ip failures hit the limit", () => {
    expect(isLocked(0, IP_FAILURE_LIMIT)).toBe(true);
  });
});

describe("checkRateLimit", () => {
  it("is unlocked with no prior attempts", async () => {
    const store = createInMemoryStore();
    const result = await checkRateLimit("a@x.com", "1.1.1.1", store);
    expect(result.locked).toBe(false);
  });

  it("locks after 5 failures for the same email within the window", async () => {
    const attempts: Attempt[] = [];
    const store = createInMemoryStore(attempts);
    const now = new Date();
    for (let i = 0; i < EMAIL_FAILURE_LIMIT - 1; i++) {
      await recordFailure("a@x.com", "1.1.1.1", store, now);
    }
    let result = await checkRateLimit("a@x.com", "1.1.1.1", store, now);
    expect(result.locked).toBe(false);

    await recordFailure("a@x.com", "1.1.1.1", store, now);
    result = await checkRateLimit("a@x.com", "1.1.1.1", store, now);
    expect(result.locked).toBe(true);
  });

  it("locks after 20 failures for the same ip across different emails", async () => {
    const attempts: Attempt[] = [];
    const store = createInMemoryStore(attempts);
    const now = new Date();
    for (let i = 0; i < IP_FAILURE_LIMIT; i++) {
      await recordFailure(`user${i}@x.com`, "9.9.9.9", store, now);
    }
    const result = await checkRateLimit(
      "someone-else@x.com",
      "9.9.9.9",
      store,
      now,
    );
    expect(result.locked).toBe(true);
  });

  it("ignores failures outside the rate-limit window", async () => {
    const attempts: Attempt[] = [];
    const store = createInMemoryStore(attempts);
    const now = new Date();
    const outsideWindow = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS - 1);
    for (let i = 0; i < EMAIL_FAILURE_LIMIT; i++) {
      await recordFailure("a@x.com", "1.1.1.1", store, outsideWindow);
    }
    const result = await checkRateLimit("a@x.com", "1.1.1.1", store, now);
    expect(result.locked).toBe(false);
  });

  it("clearFailures records a success so prior failures no longer alone determine lock state going forward", async () => {
    const attempts: Attempt[] = [];
    const store = createInMemoryStore(attempts);
    const now = new Date();
    for (let i = 0; i < EMAIL_FAILURE_LIMIT; i++) {
      await recordFailure("a@x.com", "1.1.1.1", store, now);
    }
    let result = await checkRateLimit("a@x.com", "1.1.1.1", store, now);
    expect(result.locked).toBe(true);

    await clearFailures("a@x.com", "1.1.1.1", store, now);
    // success attempts are not counted as failures, so a fresh window
    // (simulated by moving "now" forward past the window) is unlocked.
    const later = new Date(now.getTime() + RATE_LIMIT_WINDOW_MS + 1);
    result = await checkRateLimit("a@x.com", "1.1.1.1", store, later);
    expect(result.locked).toBe(false);
  });
});
