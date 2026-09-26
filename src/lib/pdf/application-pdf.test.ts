import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  buildApplicationPdfSections,
  renderApplicationPdf,
  renderApplicationPdfForRecord,
  type ApplicationPdfData,
} from "./application-pdf";
import type { memberApplications, members } from "@/db/schema";

type Member = typeof members.$inferSelect;
type Application = typeof memberApplications.$inferSelect;

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    applicationNo: "APP-7K4M2X",
    memberId: "11111111-1111-1111-1111-111111111111",
    status: "approved",
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    profession: null,
    professionOther: null,
    businessName: null,
    addressLine1: null,
    addressLine2: null,
    area: null,
    city: null,
    state: null,
    pincode: null,
    dob: null,
    bloodGroup: null,
    aadhaarEnc: null,
    aadhaarHash: null,
    aadhaarLast4: null,
    nomineeName: null,
    nomineeRelationship: null,
    nomineePhone: null,
    photoKey: null,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: new Date("2026-07-31T10:00:00Z"),
    createdAt: new Date("2026-07-01T10:00:00Z"),
    updatedAt: new Date("2026-07-31T10:00:00Z"),
    ...overrides,
  };
}

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
    professionOther: null,
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
    nomineeName: "Lakshmi Rao",
    nomineeRelationship: "Spouse",
    nomineePhone: "9845022345",
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
      "Remarks",
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

  it("uses the ledger number as membership no.", () => {
    const fields = flatten(member());
    expect(fields.find((f) => f.label === "Membership no.")?.value).toBe("42");
  });

  it("has no Member ID row", () => {
    const fields = flatten(member());
    expect(fields.find((f) => f.label === "Member ID")).toBeUndefined();
  });

  it("has no Fees paid upto row", () => {
    const fields = flatten(member());
    expect(fields.find((f) => f.label === "Fees paid upto")).toBeUndefined();
  });

  it("gives every field with a reviewed translation a Kannada label", () => {
    const fields = flatten(member());
    for (const label of [
      "Status",
      "Death fund",
      "Remarks",
      "Membership no.",
      "Nominee",
    ]) {
      expect(fields.find((f) => f.label === label)?.labelKn).toBeTruthy();
    }
  });

  it("gives the death fund value a bilingual counterpart", () => {
    const covered = flatten(member({ deathFundCovered: true })).find(
      (f) => f.label === "Death fund",
    );
    expect(covered?.valueKn).toBeTruthy();
    const notCovered = flatten(member({ deathFundCovered: false })).find(
      (f) => f.label === "Death fund",
    );
    expect(notCovered?.valueKn).toBeTruthy();
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

  it("shows the nominee on one line, skipping missing parts", () => {
    const nominee = (overrides: Partial<Member>) =>
      flatten(member(overrides)).find((f) => f.label === "Nominee")?.value;
    expect(nominee({})).toBe("Lakshmi Rao (Spouse) · 9845022345");
    expect(nominee({ nomineePhone: null })).toBe("Lakshmi Rao (Spouse)");
    expect(
      nominee({ nomineeName: null, nomineeRelationship: null, nomineePhone: null }),
    ).toBeNull();
  });

  it("surfaces empty values as null for the template to render as an em-dash", () => {
    const fields = flatten(member({ notes: null, email: null }));
    expect(fields.find((f) => f.label === "Remarks")?.value).toBeNull();
    expect(fields.find((f) => f.label === "Email")?.value).toBeNull();
  });
});

describe("renderApplicationPdf", () => {
  const baseData: Omit<ApplicationPdfData, "photo"> = {
    applicationNo: "APP-7K4M2X",
    legacyId: "42",
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

describe("renderApplicationPdfForRecord", () => {
  it("renders with the application's number and reviewedAt when approved", async () => {
    const { buffer, applicationNo } = await renderApplicationPdfForRecord(
      application({ status: "approved" }),
      member(),
    );
    expect(applicationNo).toBe("APP-7K4M2X");
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("still surfaces the application number for a rejected application", async () => {
    const { applicationNo } = await renderApplicationPdfForRecord(
      application({ status: "rejected", reviewedAt: new Date("2026-06-01T10:00:00Z") }),
      member(),
    );
    expect(applicationNo).toBe("APP-7K4M2X");
  });

  it("renders with a null application number for a member with no application on file", async () => {
    const { buffer, applicationNo } = await renderApplicationPdfForRecord(null, member());
    expect(applicationNo).toBeNull();
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  // The layout is designed to fit one page (#37). Every field is filled here —
  // including a long address and notes — so a new section that pushes it onto
  // a second page fails here rather than in the office's printer.
  it("fits on a single page with every field filled", async () => {
    const buffer = await renderApplicationPdf({
      applicationNo: "APP-7K4M2X",
      legacyId: "42",
      memberName: "Asha Rao",
      reviewedAt: new Date("2026-07-31T10:00:00Z"),
      sections: buildApplicationPdfSections(
        member({
          addressLine1: "No. 1234, 5th Cross, 2nd Main Road, Near Old Bus Stand",
          addressLine2: "Behind Sri Chamundeshwari Temple, Opposite Govt School",
          notes: "Imported from the paper ledger. ".repeat(6).trim(),
        }),
      ),
      photo: null,
    });
    const pages = buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pages).toHaveLength(1);
  });
});
