import { describe, expect, it } from "vitest";

import {
  formatPhone,
  isValidPhone,
  normalizePhone,
  phoneMatches,
} from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["plain", "9845011234"],
    ["spaced", "98450 11234"],
    ["country code", "+91 98450 11234"],
    ["country code, no plus", "919845011234"],
    ["trunk zero", "09845011234"],
    ["hyphenated", "098450-11234"],
    ["parenthesised", "(+91) 98450-11234"],
    ["zero-country combo", "0919845011234"],
    ["tab and newline noise", "\t9845011234\n"],
  ])("normalizes the %s form to the canonical 10 digits", (_label, input) => {
    expect(normalizePhone(input)).toBe("9845011234");
  });

  it.each([
    ["too short", "98450112"],
    ["too long", "98450112345"],
    ["landline range (starts 2)", "2845011234"],
    ["starts with 5", "5845011234"],
    ["empty", ""],
    ["letters only", "not a phone"],
  ])("rejects %s", (_label, input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("rejects all-same-digit placeholders from the paper ledger", () => {
    // Several members would otherwise share this, letting anyone verify as any
    // of them.
    expect(normalizePhone("9999999999")).toBeNull();
    expect(normalizePhone("8888888888")).toBeNull();
  });

  it("rejects straight digit runs", () => {
    expect(normalizePhone("9876543210")).toBeNull();
    expect(normalizePhone("6789012345")).toBeNull();
  });

  it("does not mutilate a real number that happens to start with 91", () => {
    // Stripping "91" here would leave 8 digits, so the prefix must be kept.
    expect(normalizePhone("9198765432")).toBe("9198765432");
  });

  it("does not strip a leading 9 as if it were a trunk zero", () => {
    expect(normalizePhone("9845011234")).toBe("9845011234");
  });
});

describe("isValidPhone", () => {
  it("agrees with normalizePhone", () => {
    expect(isValidPhone("+91 98450 11234")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });
});

describe("phoneMatches", () => {
  it("matches across different written forms", () => {
    expect(phoneMatches("+91 98450 11234", "9845011234")).toBe(true);
    expect(phoneMatches("098450-11234", "91 98450 11234")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(phoneMatches("9845011234", "9845011235")).toBe(false);
  });

  it("returns false when the stored ledger value is junk", () => {
    // By design: that member can't self-verify and visits the office instead.
    expect(phoneMatches("9845011234", "9999999999")).toBe(false);
    expect(phoneMatches("9845011234", "")).toBe(false);
    expect(phoneMatches("9845011234", null)).toBe(false);
  });

  it("returns false when the submitted value is junk", () => {
    expect(phoneMatches("", "9845011234")).toBe(false);
    expect(phoneMatches(null, "9845011234")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("groups as 5 + 5, the way the number is read aloud", () => {
    expect(formatPhone("9845011234")).toBe("98450 11234");
    expect(formatPhone("+919845011234")).toBe("98450 11234");
  });

  it("passes through unparseable values rather than blanking them", () => {
    // Display must never silently lose data the ledger actually holds.
    expect(formatPhone("old landline 2345")).toBe("old landline 2345");
  });
});
