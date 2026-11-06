import { describe, expect, it } from "vitest";

import {
  donationSchema,
  formatRupees,
  MAX_DONATION_AMOUNT,
  parseAmount,
} from "./validation";

describe("parseAmount", () => {
  it("reads plain and comma-grouped rupees", () => {
    expect(parseAmount("5000")).toBe(5000);
    expect(parseAmount("1,00,000")).toBe(100000);
  });

  it("rejects anything that isn't whole rupees", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("50.50")).toBeNull();
    expect(parseAmount("-50")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("formatRupees", () => {
  it("uses Indian digit grouping", () => {
    expect(formatRupees(100000)).toBe("₹1,00,000");
    expect(formatRupees(12345678)).toBe("₹1,23,45,678");
  });
});

describe("donationSchema", () => {
  const valid = { name: "ರಮೇಶ್", businessName: "", amount: "5,000" };

  it("accepts Kannada and English names, and no business", () => {
    expect(donationSchema.safeParse(valid).success).toBe(true);
    expect(
      donationSchema.safeParse({ ...valid, name: "Ramesh Kumar" }).success,
    ).toBe(true);
  });

  it("requires a name once trimmed", () => {
    expect(donationSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("rejects zero and out-of-range amounts", () => {
    expect(donationSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(
      donationSchema.safeParse({
        ...valid,
        amount: String(MAX_DONATION_AMOUNT + 1),
      }).success,
    ).toBe(false);
  });
});
