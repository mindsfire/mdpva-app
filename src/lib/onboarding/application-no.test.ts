import { describe, expect, it } from "vitest";

import {
  APPLICATION_NO_PATTERN,
  generateApplicationNo,
  normalizeApplicationNo,
} from "./application-no";

describe("generateApplicationNo", () => {
  it("produces the documented shape", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateApplicationNo()).toMatch(APPLICATION_NO_PATTERN);
    }
  });

  it("never emits the ambiguous characters I, L, O or U", () => {
    // Members read these aloud and copy them off paper, so 0/O and 1/I/L must
    // not both be possible.
    const sample = Array.from({ length: 500 }, () => generateApplicationNo())
      .join("")
      .replace(/APP-/g, "");
    expect(sample).not.toMatch(/[ILOU]/);
  });

  it("maps bytes to the alphabet deterministically", () => {
    const bytes = new Uint8Array([0, 1, 31, 32, 33, 255]);
    // 0→'0', 1→'1', 31→'Z', 32 wraps to '0', 33→'1', 255→31→'Z'
    expect(generateApplicationNo(() => bytes)).toBe("APP-01Z01Z");
  });

  it("draws from the whole alphabet", () => {
    // Real entropy check: a generator stuck on a subset of symbols would pass
    // a uniqueness test at small samples but collide constantly at scale.
    const chars = new Set(
      Array.from({ length: 2000 }, () => generateApplicationNo())
        .join("")
        .replace(/APP-/g, ""),
    );
    expect(chars.size).toBe(32);
  });

  it("collides at no more than the birthday bound", () => {
    /*
     * Deliberately NOT asserting 5000 draws are all unique.
     *
     * The keyspace is 32^6 ≈ 1.07e9, so over 5000 draws the expected number of
     * collisions is n²/2N ≈ 0.012 — meaning an exact-uniqueness assertion fails
     * on roughly 1 run in 86. It did exactly that in CI, blocking an unrelated
     * PR.
     *
     * Uniqueness was never the generator's job anyway: it's guaranteed by the
     * `member_applications_no_unique` index plus the retry loop in
     * `submitApplicationAction`. What matters here is that collisions stay rare
     * enough for that retry to be a formality.
     *
     * P(4 or more collisions) ≈ 7.7e-10, so this threshold is stable.
     */
    const n = 5000;
    const seen = new Set<string>();
    for (let i = 0; i < n; i += 1) seen.add(generateApplicationNo());
    expect(n - seen.size).toBeLessThanOrEqual(3);
  });
});

describe("normalizeApplicationNo", () => {
  it("accepts the canonical form", () => {
    expect(normalizeApplicationNo("APP-7K4M2X")).toBe("APP-7K4M2X");
  });

  it.each([
    ["lowercase", "app-7k4m2x"],
    ["no prefix", "7K4M2X"],
    ["spaces", " APP 7K4M2X "],
    ["extra hyphens", "APP-7K4-M2X"],
  ])("recovers from %s", (_label, input) => {
    expect(normalizeApplicationNo(input)).toBe("APP-7K4M2X");
  });

  it("corrects the transcription slips the alphabet was chosen to avoid", () => {
    // A member reading "0" off paper may well type "O".
    expect(normalizeApplicationNo("APP-O1234S")).toBe("APP-01234S");
    expect(normalizeApplicationNo("APP-I2345S")).toBe("APP-12345S");
    expect(normalizeApplicationNo("APP-L2345S")).toBe("APP-12345S");
  });

  it.each([
    ["too short", "APP-7K4M2"],
    ["too long", "APP-7K4M2XY"],
    ["empty", ""],
    ["junk", "hello there"],
  ])("rejects %s", (_label, input) => {
    expect(normalizeApplicationNo(input)).toBeNull();
  });
});
