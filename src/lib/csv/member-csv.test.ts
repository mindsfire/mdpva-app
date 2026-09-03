import { describe, expect, it } from "vitest";

import {
  ALL_EXPORT_FIELDS,
  CSV_HEADERS,
  coerceRow,
  EXPORT_FIELDS,
  IMPORT_REQUIRED_FIELDS,
  membersToCsv,
  parseMembersCsv,
  templateCsv,
  type ExportableMember,
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

  it("maps 'Photo & Video' label to the 'photo_and_video' enum", () => {
    const row = VALID_ROW.replace("photographer", "Photo & Video");
    const result = parseMembersCsv(csv(row));
    expect(result.rows[0]?.input.profession).toBe("photo_and_video");
  });

  it("accepts drone_operator as a profession value", () => {
    const row = VALID_ROW.replace("photographer", "drone_operator");
    const result = parseMembersCsv(csv(row));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.input.profession).toBe("drone_operator");
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

  it("export round-trips cleanly through the importer", () => {
    const out = membersToCsv([
      {
        legacyId: "77",
        firstName: "Asha",
        lastName: "Rao",
        email: null,
        phone: "9000000001",
        profession: "drone_operator",
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
      aadhaarLast4: null,
      },
    ]);
    // legacy_id leads the default export (the recognised membership number);
    // the generated member_id is never emitted at all.
    expect(out.split("\n")[0]).toBe(ALL_EXPORT_FIELDS.join(","));
    const reparsed = parseMembersCsv(out);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.rows[0]?.input.firstName).toBe("Asha");
    expect(reparsed.rows[0]?.input.legacyId).toBe("77");
    expect(reparsed.unknownHeaders).toEqual([]);
  });
});

describe("EXPORT_FIELDS", () => {
  // The picker's field list and the CSV writer's columns must never drift: the
  // canonical file order is `legacy_id` first, then every other CSV_HEADERS
  // column in their original relative order, and never the generated
  // member_id. A field added to one without the other should fail here rather
  // than silently vanish from the dialog or the file.
  it("matches CSV_HEADERS with legacy_id moved to the front", () => {
    const expected = [
      "legacy_id",
      ...CSV_HEADERS.filter((h) => h !== "legacy_id"),
    ];
    expect(ALL_EXPORT_FIELDS).toEqual(expected);
    expect(EXPORT_FIELDS.map((f) => f.key)).toEqual(expected);
  });

  it("never offers the generated member_id as a field", () => {
    expect(ALL_EXPORT_FIELDS).not.toContain("member_id");
  });

  it("puts legacy_id first", () => {
    expect(ALL_EXPORT_FIELDS[0]).toBe("legacy_id");
    expect(EXPORT_FIELDS[0]?.key).toBe("legacy_id");
  });

  it("gives every field a non-empty label", () => {
    for (const field of EXPORT_FIELDS) {
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it("lists only importer-required columns as required", () => {
    for (const key of IMPORT_REQUIRED_FIELDS) {
      expect(ALL_EXPORT_FIELDS).toContain(key);
    }
    // Mirrors parseMembersCsv's missingHeaders list.
    expect(IMPORT_REQUIRED_FIELDS).toEqual([
      "first_name",
      "last_name",
      "address_line1",
      "city",
      "state",
    ]);
  });
});

describe("membersToCsv column selection", () => {
  const MEMBER: ExportableMember = {
    legacyId: "42",
    firstName: "Asha",
    lastName: null,
    email: "asha@example.com",
    phone: "9000000001",
    profession: "photographer",
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
    feesPaidUpto: 2026,
    deathFundCovered: true,
    notes: null,
    aadhaarLast4: null,
  };

  it("emits only the requested columns, in canonical order", () => {
    // Deliberately pass out of order; the writer keeps the caller's order.
    const out = membersToCsv([MEMBER], ["phone", "legacy_id", "first_name"]);
    const [header, row] = out.split("\n");
    expect(header).toBe("phone,legacy_id,first_name");
    expect(row).toBe("9000000001,42,Asha");
  });

  it("defaults to the full column set when none is given", () => {
    const out = membersToCsv([MEMBER]);
    expect(out.split("\n")[0]).toBe(ALL_EXPORT_FIELDS.join(","));
  });

  it("still escapes formula-injection in a narrowed export", () => {
    const evil = { ...MEMBER, firstName: "=HYPERLINK(1)" };
    const out = membersToCsv([evil], ["first_name"]);
    // Escaped values are prefixed so a spreadsheet treats them as text.
    expect(out).toContain("'=HYPERLINK(1)");
  });
});
