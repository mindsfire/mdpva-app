import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  buildApplicationPdfSections,
  renderApplicationPdf,
  type ApplicationPdfData,
} from "./application-pdf";
import type { members } from "@/db/schema";

type Member = typeof members.$inferSelect;

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    memberId: "MDPVA-2026-0001",
    legacyId: "42",
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: "9000000001",
    normalizedPhone: "9000000001",
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
    aadhaarEnc: null,
    aadhaarHash: null,
    aadhaarLast4: "1234",
    status: "active",
    feesPaidUpto: 2026,
    deathFundCovered: true,
    photoKey: "app/members/11111111-1111-1111-1111-111111111111.webp",
    notes: "Imported from the paper ledger.",
    createdBy: null,
    updatedBy: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-15"),
    deletedAt: null,
    ...overrides,
  };
}

const flatten = (m: Member) => buildApplicationPdfSections(m).flatMap((s) => s.fields);

describe("buildApplicationPdfSections", () => {
  it("includes every section", () => {
    const titles = buildApplicationPdfSections(member()).map((s) => s.title);
    expect(titles).toEqual([
      "Identity",
      "Contact",
      "Address",
      "Association",
      "Membership",
      "Notes",
    ]);
  });

  it("maps profession to its display label", () => {
    const value = flatten(member({ profession: "photo_and_video" })).find(
      (f) => f.label === "Profession",
    )?.value;
    expect(value).toBe("Photo & Video");
  });

  it("masks the Aadhaar number, never showing it in full", () => {
    const value = flatten(member({ aadhaarLast4: "5678" })).find(
      (f) => f.label === "Aadhaar",
    )?.value;
    expect(value).toBe("XXXX XXXX 5678");
  });

  it("renders death fund cover as words, not a boolean", () => {
    expect(
      flatten(member({ deathFundCovered: false })).find(
        (f) => f.label === "Death fund",
      )?.value,
    ).toBe("Not covered");
  });

  it("uses the ledger number as membership no. and includes the system member id", () => {
    const fields = flatten(member());
    expect(fields.find((f) => f.label === "Membership no.")?.value).toBe("42");
    expect(fields.find((f) => f.label === "Member ID")?.value).toBe("MDPVA-2026-0001");
  });

  // A sparse ledger-imported member must still show every row — "empty" is
  // never mistaken for "hidden".
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
        aadhaarLast4: null,
        feesPaidUpto: null,
        notes: null,
      }),
    ).map((f) => f.label);

    expect(empty).toEqual(full);
  });

  it("surfaces empty values as null for the template to render as an em-dash", () => {
    const fields = flatten(member({ notes: null, email: null }));
    expect(fields.find((f) => f.label === "Notes")?.value).toBeNull();
    expect(fields.find((f) => f.label === "Email")?.value).toBeNull();
  });
});

describe("renderApplicationPdf", () => {
  const baseData: Omit<ApplicationPdfData, "photo"> = {
    applicationNo: "APP-7K4M2X",
    legacyId: "42",
    memberId: "MDPVA-2026-0001",
    memberName: "Asha Rao",
    reviewedAt: new Date("2026-07-31T10:00:00Z"),
    sections: buildApplicationPdfSections(member()),
  };

  it("renders a valid PDF buffer with no photo", async () => {
    const buffer = await renderApplicationPdf({ ...baseData, photo: null });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("renders a valid PDF buffer with a photo embedded", async () => {
    const png = await sharp({
      create: { width: 108, height: 139, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();

    const buffer = await renderApplicationPdf({
      ...baseData,
      photo: { buffer: png, format: "png" },
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
