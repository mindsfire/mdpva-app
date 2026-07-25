import { describe, expect, it } from "vitest";

import { generateMemberId } from "./member-id";

describe("generateMemberId", () => {
  it("formats year and zero-padded sequence", () => {
    expect(generateMemberId(2026, 42)).toBe("MDPVA-2026-0042");
  });

  it("pads single-digit sequence", () => {
    expect(generateMemberId(2026, 1)).toBe("MDPVA-2026-0001");
  });

  it("does not truncate sequences beyond 4 digits", () => {
    expect(generateMemberId(2026, 12345)).toBe("MDPVA-2026-12345");
  });

  it("throws on non-positive sequence", () => {
    expect(() => generateMemberId(2026, 0)).toThrow();
  });
});
