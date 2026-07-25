import { describe, expect, it, vi } from "vitest";

import { computePasswordChange } from "@/lib/password-change";

function deps(matches: boolean) {
  return {
    compare: vi.fn(async () => matches),
    hash: vi.fn(async (plain: string) => `hashed:${plain}`),
  };
}

describe("computePasswordChange", () => {
  it("rejects a new password shorter than 10 characters without touching hashing", async () => {
    const d = deps(true);
    const result = await computePasswordChange(
      { passwordHash: "old-hash", tokenVersion: 1 },
      { current: "correct-current", next: "short" },
      d,
    );
    expect(result.ok).toBe(false);
    expect(d.compare).not.toHaveBeenCalled();
    expect(d.hash).not.toHaveBeenCalled();
  });

  it("rejects when the current password doesn't match", async () => {
    const d = deps(false);
    const result = await computePasswordChange(
      { passwordHash: "old-hash", tokenVersion: 1 },
      { current: "wrong-current", next: "a-long-enough-password" },
      d,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid current password.");
    }
    expect(d.hash).not.toHaveBeenCalled();
  });

  it("bumps token_version and clears mustChangePassword on success", async () => {
    const d = deps(true);
    const result = await computePasswordChange(
      { passwordHash: "old-hash", tokenVersion: 3 },
      { current: "correct-current", next: "a-long-enough-password" },
      d,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokenVersion).toBe(4);
      expect(result.mustChangePassword).toBe(false);
      expect(result.passwordHash).toBe("hashed:a-long-enough-password");
    }
  });

  it("always increments by exactly 1 regardless of starting value", async () => {
    const d = deps(true);
    const result = await computePasswordChange(
      { passwordHash: "old-hash", tokenVersion: 41 },
      { current: "correct-current", next: "a-long-enough-password" },
      d,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tokenVersion).toBe(42);
  });
});
