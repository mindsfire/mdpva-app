import { describe, expect, it } from "vitest";

import { isFeesPaid } from "./fees";

describe("isFeesPaid", () => {
  const now = new Date("2026-07-25T00:00:00Z");

  it("returns false for null", () => {
    expect(isFeesPaid(null, now)).toBe(false);
  });

  it("returns false for a past year", () => {
    expect(isFeesPaid(2025, now)).toBe(false);
  });

  it("returns true for the current year", () => {
    expect(isFeesPaid(2026, now)).toBe(true);
  });

  it("returns true for a future year", () => {
    expect(isFeesPaid(2027, now)).toBe(true);
  });

  it("defaults now to the current date when omitted", () => {
    const currentYear = new Date().getFullYear();
    expect(isFeesPaid(currentYear)).toBe(true);
    expect(isFeesPaid(currentYear - 1)).toBe(false);
  });
});
