import { describe, expect, it } from "vitest";

import {
  CSV_HEADERS,
  coerceRow,
  membersToCsv,
  parseMembersCsv,
  templateCsv,
} from "./member-csv";

const HEADER_LINE = CSV_HEADERS.join(",");

function csv(...rows: string[]): string {
  return [HEADER_LINE, ...rows].join("\n");
}

const VALID_ROW =
  // Phone is deliberately not 9876543210 — that descending run is rejected as
  // ledger placeholder junk (see `normalizePhone`).
  "Ramesh,Kumar,ramesh@example.com,9845011234,OLD/1,photographer,Studio,12 MG Road,,Lakshmipuram,Mysuru,Karnataka,570004,1975-06-15,B+,active,2026,yes,";

describe("parseMembersCsv", () => {
  it("parses a valid row into MemberInput", () => {
    const result = parseMembersCsv(csv(VALID_ROW));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const input = result.rows[0].input;
    expect(input.firstName).toBe("Ramesh");
    expect(input.legacyId).toBe("OLD/1");
    expect(input.profession).toBe("photographer");
    expect(input.feesPaidUpto).toBe(2026);
    expect(input.deathFundCovered).toBe(true);
  });

  it("maps 'Photo & Video' label to the 'both' enum", () => {
    const row = VALID_ROW.replace("photographer", "Photo & Video");
    const result = parseMembersCsv(csv(row));
    expect(result.rows[0]?.input.profession).toBe("both");
  });

  it("reports row-level validation errors with 1-based row numbers", () => {
    const bad =
      ",Kumar,not-an-email,,,photographer,,12 MG Road,,,Mysuru,Karnataka,12345,,,active,,no,";
    const result = parseMembersCsv(csv(VALID_ROW, bad));
    expect(result.rows).toHaveLength(1);
    const rows = result.errors.map((e) => e.row);
    expect(new Set(rows)).toEqual(new Set([2]));
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("firstName");
    expect(fields).toContain("email");
    expect(fields).toContain("pincode");
  });

  it("flags missing required headers and unknown headers", () => {
    const result = parseMembersCsv("first_name,surname\nRamesh,Kumar");
    expect(result.missingHeaders).toContain("last_name");
    expect(result.unknownHeaders).toContain("surname");
  });

  it("normalizes header spacing/case ('First Name' -> first_name)", () => {
    const header = CSV_HEADERS.join(",").replace("first_name", "First Name");
    const result = parseMembersCsv([header, VALID_ROW].join("\n"));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.input.firstName).toBe("Ramesh");
  });

  it("rejects invalid death_fund_covered values instead of guessing", () => {
    const row = VALID_ROW.replace(",yes,", ",maybe,");
    const result = parseMembersCsv(csv(row));
    expect(result.rows).toHaveLength(0);
    expect(result.errors.some((e) => e.field === "deathFundCovered")).toBe(true);
  });

  it("skips blank lines", () => {
    const result = parseMembersCsv(csv(VALID_ROW, "", "  "));
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});

describe("coerceRow column coverage", () => {
  // `notes` was declared in CSV_HEADERS and offered in the template, but never
  // mapped in coerceRow — so every imported note was silently dropped. This
  // asserts each column actually reaches the parsed input.
  const SAMPLE: Record<string, string> = {
    first_name: "Asha",
    last_name: "Rao",
    email: "asha@example.com",
    phone: "9000000001",
    legacy_id: "42",
    profession: "photographer",
    business_name: "Asha Studio",
    address_line1: "5 Temple St",
    address_line2: "Near the tank",
    area: "Lakshmipuram",
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570001",
    dob: "1980-01-31",
    blood_group: "O+",
    status: "active",
    fees_paid_upto: "2026",
    death_fund_covered: "true",
    notes: "Imported from the paper ledger.",
  };

  it("carries every CSV column into the validated input", () => {
    const result = coerceRow(SAMPLE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      firstName: "Asha",
      lastName: "Rao",
      email: "asha@example.com",
      phone: "9000000001",
      legacyId: "42",
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
      notes: "Imported from the paper ledger.",
    });
  });

  it("preserves notes through a full parse", () => {
    const csv = [
      CSV_HEADERS.join(","),
      CSV_HEADERS.map((h) => `"${SAMPLE[h] ?? ""}"`).join(","),
    ].join("\n");
    const parsed = parseMembersCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]?.input.notes).toBe("Imported from the paper ledger.");
  });
});

describe("templateCsv / membersToCsv", () => {
  it("template parses cleanly through the importer itself", () => {
    const result = parseMembersCsv(templateCsv());
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.missingHeaders).toEqual([]);
    expect(result.unknownHeaders).toEqual([]);
  });

  it("export round-trips through the importer (minus member_id)", () => {
    const out = membersToCsv([
      {
        memberId: "MDPVA-2026-0001",
        legacyId: null,
        firstName: "Asha",
        lastName: "Rao",
        email: null,
        phone: "9000000001",
        profession: "both",
        businessName: null,
        addressLine1: "5 Temple St",
        addressLine2: null,
        area: null,
        city: "Mysuru",
        state: "Karnataka",
        pincode: "570001",
        dob: null,
        bloodGroup: null,
        status: "active",
        feesPaidUpto: null,
        deathFundCovered: false,
      notes: null,
      },
    ]);
    expect(out.split("\n")[0]).toBe(["member_id", ...CSV_HEADERS].join(","));
    const reparsed = parseMembersCsv(out);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.rows[0]?.input.firstName).toBe("Asha");
    // member_id is intentionally ignored on import (server-generated).
    expect(reparsed.unknownHeaders).toEqual(["member_id"]);
  });
});
