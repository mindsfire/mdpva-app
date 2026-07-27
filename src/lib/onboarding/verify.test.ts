import { describe, expect, it } from "vitest";

import {
  decideVerification,
  normalizeLedgerId,
  type VerifiableMember,
} from "./verify";

const member = (over: Partial<VerifiableMember> = {}): VerifiableMember => ({
  id: "m1",
  legacyId: "417",
  normalizedPhone: "9845011234",
  firstName: "Aarav",
  lastName: "Sharma",
  ...over,
});

describe("normalizeLedgerId", () => {
  it.each([
    ["bare", "417"],
    ["zero padded", "0417"],
    ["with prefix", "MDPVA/417"],
    ["with words", "no. 417"],
    ["with spaces", " 417 "],
  ])("reduces the %s form to 417", (_label, input) => {
    expect(normalizeLedgerId(input)).toBe("417");
  });

  it.each([
    ["empty", ""],
    ["letters only", "abc"],
    ["zero", "0"],
    ["out of range", "10000"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_label, input) => {
    expect(normalizeLedgerId(input)).toBeNull();
  });
});

describe("decideVerification", () => {
  it("matches on ledger id and phone together", () => {
    const result = decideVerification("417", "9845011234", [member()]);
    expect(result).toEqual({
      ok: true,
      memberId: "m1",
      displayName: "Aarav Sharma",
    });
  });

  it("matches across differently written phone and ledger forms", () => {
    const result = decideVerification("MDPVA/0417", "+91 98450 11234", [
      member(),
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects the right ledger id with the wrong phone", () => {
    const result = decideVerification("417", "9845011299", [member()]);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects a ledger id that isn't present", () => {
    const result = decideVerification("999", "9845011234", [member()]);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("reports the same reason for unknown id and wrong phone", () => {
    // Distinguishing them would confirm which membership numbers exist.
    const unknownId = decideVerification("999", "9845011234", [member()]);
    const wrongPhone = decideVerification("417", "9845011299", [member()]);
    expect(unknownId).toEqual(wrongPhone);
  });

  it("cannot be claimed when the stored phone is junk", () => {
    // That member visits the office instead — by design.
    const result = decideVerification("417", "9845011234", [
      member({ normalizedPhone: null }),
    ]);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("cannot be claimed when the member has no legacy id", () => {
    const result = decideVerification("417", "9845011234", [
      member({ legacyId: null }),
    ]);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("flags malformed input before any matching", () => {
    expect(decideVerification("", "9845011234", [member()])).toEqual({
      ok: false,
      reason: "invalid_input",
    });
    expect(decideVerification("417", "12345", [member()])).toEqual({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("picks the right member when two share a phone number", () => {
    // A father and son on one studio line — the ledger id disambiguates, which
    // is why dropping the phone unique index is safe.
    const father = member({ id: "dad", legacyId: "417", firstName: "Ravi" });
    const son = member({ id: "son", legacyId: "902", firstName: "Kiran" });

    expect(decideVerification("417", "9845011234", [father, son])).toMatchObject(
      { ok: true, memberId: "dad" },
    );
    expect(decideVerification("902", "9845011234", [father, son])).toMatchObject(
      { ok: true, memberId: "son" },
    );
  });

  it("returns only the member's name, never other fields", () => {
    const result = decideVerification("417", "9845011234", [member()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result).sort()).toEqual([
        "displayName",
        "memberId",
        "ok",
      ]);
    }
  });
});
