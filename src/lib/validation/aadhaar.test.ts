import { describe, expect, it } from "vitest";

import { isValidAadhaar, maskAadhaar, normalizeAadhaar } from "./aadhaar";

// Verhoeff-valid check digits computed offline for these bases.
const VALID = "234567890124";
const VALID_2 = "876543210988";

describe("normalizeAadhaar", () => {
  it("strips spaces and hyphens", () => {
    expect(normalizeAadhaar("2345 6789 0124")).toBe(VALID);
    expect(normalizeAadhaar("2345-6789-0124")).toBe(VALID);
  });

  it("rejects the wrong length", () => {
    expect(normalizeAadhaar("12345678901")).toBeNull(); // 11 digits
    expect(normalizeAadhaar("1234567890123")).toBeNull(); // 13 digits
  });

  it("rejects non-digit characters", () => {
    expect(normalizeAadhaar("2345678901ab")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(normalizeAadhaar(null)).toBeNull();
    expect(normalizeAadhaar(undefined)).toBeNull();
  });
});

describe("isValidAadhaar", () => {
  it("accepts a valid Aadhaar number", () => {
    expect(isValidAadhaar(VALID)).toBe(true);
    expect(isValidAadhaar(VALID_2)).toBe(true);
  });

  it("accepts loosely formatted valid input", () => {
    expect(isValidAadhaar("2345 6789 0124")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidAadhaar("23456789012")).toBe(false); // 11 digits
    expect(isValidAadhaar("2345678901245")).toBe(false); // 13 digits
  });

  it("rejects a number starting with 0", () => {
    expect(isValidAadhaar("0" + VALID.slice(1))).toBe(false);
  });

  it("rejects a number starting with 1", () => {
    expect(isValidAadhaar("1" + VALID.slice(1))).toBe(false);
  });

  it("rejects a bad Verhoeff checksum", () => {
    // Flip the last digit — checksum digit is now wrong.
    const lastDigit = VALID[VALID.length - 1];
    const bumped = String((Number(lastDigit) + 1) % 10);
    const tampered = VALID.slice(0, -1) + bumped;
    expect(isValidAadhaar(tampered)).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidAadhaar("abcd6789012x")).toBe(false);
  });

  it("rejects null/undefined/empty", () => {
    expect(isValidAadhaar(null)).toBe(false);
    expect(isValidAadhaar(undefined)).toBe(false);
    expect(isValidAadhaar("")).toBe(false);
  });
});

describe("maskAadhaar", () => {
  it("shows only the last 4 digits", () => {
    expect(maskAadhaar("0124")).toBe("XXXX XXXX 0124");
  });

  it("falls back to a fully masked string when last4 is missing/malformed", () => {
    expect(maskAadhaar(null)).toBe("XXXX XXXX XXXX");
    expect(maskAadhaar(undefined)).toBe("XXXX XXXX XXXX");
    expect(maskAadhaar("12")).toBe("XXXX XXXX XXXX");
  });
});
