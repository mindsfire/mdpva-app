/**
 * Field-by-field comparison of a submitted application against the member
 * record it would replace.
 *
 * Pure so it can be tested directly — this is what an admin actually reads
 * when deciding to approve, and getting "changed" wrong either hides a real
 * edit or cries wolf on every row.
 */

import { sanitizeText } from "@/lib/validation/text-safety";

export const DIFF_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "addressLine1",
  "addressLine2",
  "area",
  "pincode",
  "city",
  "state",
  "profession",
  "businessName",
  "dob",
  "bloodGroup",
  /**
   * Compares only the last-4 marker, never the encrypted value or the hash —
   * `aadhaarEnc`/`aadhaarHash` are deliberately not diffable fields, so an
   * admin reviewing this screen can see *that* the Aadhaar changed without
   * either side ever rendering the full number.
   */
  "aadhaarLast4",
] as const;

export type DiffField = (typeof DIFF_FIELDS)[number];

export const FIELD_LABELS: Record<DiffField, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  email: "Email",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  area: "Area",
  pincode: "Pincode",
  city: "City",
  state: "State",
  profession: "Profession",
  businessName: "Business name",
  dob: "Date of birth",
  bloodGroup: "Blood group",
  aadhaarLast4: "Aadhaar (last 4)",
};

/**
 * `kept` — the member left an optional field blank while the record holds a
 * value. Approval does *not* clear it (see `applicationToMemberValues`), so
 * labelling this "cleared" would misrepresent what the admin is about to do.
 */
export type ChangeKind = "added" | "changed" | "kept" | "same";

export interface FieldDiff {
  field: DiffField;
  label: string;
  current: string | null;
  submitted: string | null;
  kind: ChangeKind;
}

type Row = Partial<Record<DiffField, unknown>>;

function normalize(value: unknown): string | null {
  if (value == null) return null;
  const s = sanitizeText(String(value));
  return s === "" ? null : s;
}

/**
 * `added` is separated from `changed` because during the ledger migration
 * almost every field is empty-to-value. Lumping them together would paint a
 * first-time submission entirely as "changed" and make the genuinely edited
 * fields — the ones worth an admin's attention — impossible to spot.
 */
function classify(current: string | null, submitted: string | null): ChangeKind {
  if (current === submitted) return "same";
  if (current === null) return "added";
  if (submitted === null) return "kept";
  return "changed";
}

export function diffApplication(current: Row, submitted: Row): FieldDiff[] {
  return DIFF_FIELDS.map((field) => {
    const a = normalize(current[field]);
    const b = normalize(submitted[field]);
    return {
      field,
      label: FIELD_LABELS[field],
      current: a,
      submitted: b,
      kind: classify(a, b),
    };
  });
}

/**
 * Count of fields approval will actually write. `kept` is excluded — nothing
 * happens to those, so counting them would overstate the change.
 */
export function countChanges(diffs: FieldDiff[]): number {
  return diffs.filter((d) => d.kind === "added" || d.kind === "changed").length;
}
