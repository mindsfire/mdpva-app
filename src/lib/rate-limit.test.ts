import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  clearFailures,
  IDENTIFIER_IP_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  isLocked,
  RATE_LIMIT_WINDOW_MS,
  recordFailure,
  type RateLimitStore,
} from "@/lib/rate-limit";

type Attempt = {
  identifier: string | null;
  ip: string | null;
  success: boolean;
  createdAt: number;
};

function createInMemoryStore(attempts: Attempt[] = []): RateLimitStore {
  return {
    async countRecentFailures(scope, identifier, ip, since) {
      return attempts.filter((a) => {
        if (a.success || a.createdAt < since.getTime()) return false;
        if (scope === "identifier+ip")
          return a.identifier === identifier && a.ip === ip;
        if (scope === "ip") return a.ip === ip;
        return a.identifier === identifier;
      }).length;
    },
    async recordAttempt(identifier, ip, success, now = new Date()) {
      attempts.push({ identifier, ip, success, createdAt: now.getTime() });
    },
  };
}

describe("isLocked", () => {
  it("is not locked below both thresholds", () => {
    expect(isLocked(0, 0)).toBe(false);
    expect(isLocked(IDENTIFIER_IP_FAILURE_LIMIT - 1, IP_FAILURE_LIMIT - 1)).toBe(
      false,
    );
  });

  it("locks once email failures hit the limit", () => {
    expect(isLocked(IDENTIFIER_IP_FAILURE_LIMIT, 0)).toBe(true);
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
    for (let i = 0; i < IDENTIFIER_IP_FAILURE_LIMIT - 1; i++) {
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
    for (let i = 0; i < IDENTIFIER_IP_FAILURE_LIMIT; i++) {
      await recordFailure("a@x.com", "1.1.1.1", store, outsideWindow);
    }
    const result = await checkRateLimit("a@x.com", "1.1.1.1", store, now);
    expect(result.locked).toBe(false);
  });

  it("clearFailures records a success so prior failures no longer alone determine lock state going forward", async () => {
    const attempts: Attempt[] = [];
    const store = createInMemoryStore(attempts);
    const now = new Date();
    for (let i = 0; i < IDENTIFIER_IP_FAILURE_LIMIT; i++) {
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

describe("third-party lockout (regression)", () => {
  /**
   * The bug this replaces: failures were counted per identifier across all
   * IPs, so five failed attempts from anywhere locked the real account holder
   * out — five requests every fifteen minutes, indefinitely, against a known
   * admin address. The defence was a better attack than the one it prevented.
   */
  it("an attacker cannot lock out the real account holder", async () => {
    const store = createInMemoryStore();
    const victim = "admin@mdpva.org";

    for (let i = 0; i < IDENTIFIER_IP_FAILURE_LIMIT * 4; i += 1) {
      await recordFailure(victim, "203.0.113.66", store);
    }

    const attacker = await checkRateLimit(victim, "203.0.113.66", store);
    expect(attacker.locked).toBe(true); // attacker blocks themselves

    const realUser = await checkRateLimit(victim, "49.207.1.1", store);
    expect(realUser.locked).toBe(false); // and the owner is unaffected
  });

  it("still blocks a genuine brute force from one source", async () => {
    const store = createInMemoryStore();
    for (let i = 0; i < IDENTIFIER_IP_FAILURE_LIMIT; i += 1) {
      await recordFailure("admin@mdpva.org", "203.0.113.66", store);
    }
    const result = await checkRateLimit("admin@mdpva.org", "203.0.113.66", store);
    expect(result.locked).toBe(true);
  });

  it("still blocks one source spraying many accounts", async () => {
    const store = createInMemoryStore();
    // Under the per-account limit each time, but many accounts from one IP.
    for (let i = 0; i < IP_FAILURE_LIMIT; i += 1) {
      await recordFailure(`user${i}@mdpva.org`, "203.0.113.66", store);
    }
    const result = await checkRateLimit("fresh@mdpva.org", "203.0.113.66", store);
    expect(result.locked).toBe(true);
  });

  it("surfaces a distributed attack as a signal, never as a block", async () => {
    const store = createInMemoryStore();
    // Many IPs, few attempts each — the pattern that must not cause lockout.
    for (let i = 0; i < 30; i += 1) {
      await recordFailure("admin@mdpva.org", `198.51.100.${i}`, store);
    }
    const result = await checkRateLimit("admin@mdpva.org", "49.207.1.1", store);
    expect(result.locked).toBe(false);
    expect(result.distributedAttackSuspected).toBe(true);
    expect(result.distributedFailures).toBe(30);
  });
});
