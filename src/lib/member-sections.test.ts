import { describe, expect, it } from "vitest";

import { buildMemberSections } from "./member-sections";
import type { MemberDetail } from "./members-query";

function member(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    memberId: "MDPVA-2026-0001",
    legacyId: "42",
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: "9000000001",
    profession: "photographer",
    businessName: "Asha Studio",
    addressLine1: "5 Temple St",
    addressLine2: "Near the tank",
    area: "Lakshmipuram",
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570001",
    dob: "1980-01-31",
    bloodGroup: "O+",
    status: "active",
    feesPaidUpto: 2026,
    deathFundCovered: true,
    photoKey: null,
    notes: "Imported from the paper ledger.",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-15"),
    updatedByName: null,
    ...overrides,
  };
}

const flatten = (m: MemberDetail) =>
  buildMemberSections(m).flatMap((s) => s.fields);

describe("buildMemberSections", () => {
  it("splits address line 1 and line 2 into separate fields", () => {
    const labels = flatten(member()).map((f) => f.label);
    expect(labels).toContain("Address line 1");
    expect(labels).toContain("Address line 2");
  });

  it("includes notes as a field", () => {
    const notes = flatten(member()).find((f) => f.label === "Notes");
    expect(notes?.value).toBe("Imported from the paper ledger.");
  });

  // The regression this file exists to prevent: a member with nothing filled
  // in must still show every row, so "empty" is never mistaken for "hidden".
  it("returns the same fields when every optional value is null", () => {
    const full = flatten(member()).map((f) => f.label);
    const empty = flatten(
      member({
        legacyId: null,
        email: null,
        phone: null,
        profession: null,
        businessName: null,
        addressLine2: null,
        area: null,
        pincode: null,
        dob: null,
        bloodGroup: null,
        feesPaidUpto: null,
        notes: null,
      }),
    ).map((f) => f.label);

    expect(empty).toEqual(full);
  });

  it("surfaces empty values as null for the caller to render", () => {
    const fields = flatten(member({ notes: null, email: null }));
    expect(fields.find((f) => f.label === "Notes")?.value).toBeNull();
    expect(fields.find((f) => f.label === "Email")?.value).toBeNull();
  });

  it("maps profession to its display label", () => {
    const value = flatten(member({ profession: "photo_and_video" })).find(
      (f) => f.label === "Profession",
    )?.value;
    expect(value).toBe("Photo & Video");
  });

  it("maps drone_operator to its display label", () => {
    const value = flatten(member({ profession: "drone_operator" })).find(
      (f) => f.label === "Profession",
    )?.value;
    expect(value).toBe("Drone Operator");
  });

  it("renders death fund cover as words, not a boolean", () => {
    expect(
      flatten(member({ deathFundCovered: false })).find(
        (f) => f.label === "Death fund",
      )?.value,
    ).toBe("Not covered");
  });
});

describe("record section", () => {
  it("includes created, updated and who last changed it", () => {
    const record = buildMemberSections(member()).find(
      (s) => s.title === "Record",
    );
    expect(record?.fields.map((f) => f.label)).toEqual([
      "Created",
      "Last updated",
      "Last updated by",
    ]);
  });

  it("formats dates as a readable day", () => {
    const record = buildMemberSections(
      member({ createdAt: new Date("2026-07-31T10:00:00Z") }),
    ).find((s) => s.title === "Record");
    expect(record?.fields[0]?.value).toBe("31 Jul 2026");
  });

  // Imported members were written by a script, so this is the common case.
  it("leaves the editor null when no person has touched the record", () => {
    const record = buildMemberSections(member({ updatedByName: null })).find(
      (s) => s.title === "Record",
    );
    expect(record?.fields[2]?.value).toBeNull();
  });
});
