import Papa from "papaparse";
import { describe, expect, it } from "vitest";

import {
  applicationCsvHeaders,
  applicationsToCsv,
  type ExportableApplication,
} from "./application-csv";

function app(overrides: Partial<ExportableApplication> = {}): ExportableApplication {
  return {
    applicationNo: "APP-7K4M2X",
    status: "rejected",
    legacyId: "42",
    firstName: "Asha Rao",
    phone: "9845011234",
    email: "asha@example.com",
    profession: "photographer",
    professionOther: null,
    businessName: "Asha Studio",
    addressLine1: "12, MG Road",
    addressLine2: null,
    area: "Lakshmipuram",
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570004",
    dob: "1975-06-15",
    bloodGroup: "B+",
    aadhaarLast4: "1234",
    nomineeName: "Lakshmi",
    nomineeRelationship: "Spouse",
    nomineePhone: "9845022345",
    // 2026-07-31 00:30 IST — the IST date must win over the UTC one.
    createdAt: new Date("2026-07-30T19:00:00Z"),
    reviewedAt: new Date("2026-08-01T04:30:00Z"),
    reviewerName: "Office Admin",
    reviewerEmail: "admin@example.com",
    rejectionReason: "Photo is blurry",
    ...overrides,
  };
}

function parse(csv: string) {
  return Papa.parse<Record<string, string>>(csv, { header: true }).data;
}

describe("applicationCsvHeaders", () => {
  it("adds the review columns only where they can hold a value", () => {
    const pending = applicationCsvHeaders("pending");
    expect(pending).not.toContain("Reviewed");
    expect(pending).not.toContain("Rejection reason");

    const approved = applicationCsvHeaders("approved");
    expect(approved).toContain("Reviewed by");
    expect(approved).not.toContain("Rejection reason");

    const rejected = applicationCsvHeaders("rejected");
    expect(rejected.slice(-3)).toEqual([
      "Reviewed",
      "Reviewed by",
      "Rejection reason",
    ]);
  });
});

describe("applicationsToCsv", () => {
  it("writes the submitted values, review trail and rejection reason", () => {
    const [row] = parse(applicationsToCsv([app()], "rejected"));
    expect(row["Application No."]).toBe("APP-7K4M2X");
    expect(row["Membership No. (ledger)"]).toBe("42");
    expect(row["Full name"]).toBe("Asha Rao");
    expect(row["Profession"]).toBe("Photographer");
    expect(row["Date of birth"]).toBe("15-06-1975");
    expect(row["Aadhaar (last 4)"]).toBe("•••• •••• 1234");
    expect(row["Submitted"]).toMatch(/^31 Jul 2026, 12:30 am IST$/);
    expect(row["Reviewed by"]).toBe("Office Admin");
    expect(row["Rejection reason"]).toBe("Photo is blurry");
  });

  it("shows an 'other' profession as the member's own description", () => {
    const [row] = parse(
      applicationsToCsv(
        [app({ profession: "other", professionOther: "Album Framing" })],
        "rejected",
      ),
    );
    expect(row["Profession"]).toBe("Album Framing");
  });

  it("falls back to the reviewer's email when they have no name", () => {
    const [row] = parse(
      applicationsToCsv([app({ reviewerName: null })], "rejected"),
    );
    expect(row["Reviewed by"]).toBe("admin@example.com");
  });

  it("leaves blanks for missing values rather than 'null'", () => {
    const [row] = parse(
      applicationsToCsv(
        [app({ email: null, dob: null, aadhaarLast4: null, rejectionReason: null })],
        "rejected",
      ),
    );
    expect(row["Email"]).toBe("");
    expect(row["Date of birth"]).toBe("");
    expect(row["Aadhaar (last 4)"]).toBe("");
    expect(row["Rejection reason"]).toBe("");
  });

  it("neutralises spreadsheet formulas in submitted text", () => {
    const [row] = parse(
      applicationsToCsv(
        [app({ firstName: '=HYPERLINK("http://evil.test","x")', rejectionReason: "+1 dup" })],
        "rejected",
      ),
    );
    expect(row["Full name"]).toBe(`'=HYPERLINK("http://evil.test","x")`);
    expect(row["Rejection reason"]).toBe("'+1 dup");
  });

  it("writes just the header row for an empty tab", () => {
    const csv = applicationsToCsv([], "pending");
    expect(csv.trimEnd().split("\n")).toHaveLength(1);
    expect(csv.startsWith("Application No.,Status,")).toBe(true);
  });
});
