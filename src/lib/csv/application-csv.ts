import Papa from "papaparse";

import type { ApplicationTab } from "@/lib/applications-params";
import { formatDateTimeIST, isoToDisplay } from "@/lib/format-date";
import { fullName } from "@/lib/member-name";
import { professionLabel } from "@/lib/profession";
import { escapeCsvCell } from "@/lib/validation/text-safety";

/**
 * One application as the export needs it: the values the member *submitted*
 * (not the member record's current values), plus the ledger number to find
 * them by and the review trail.
 */
export interface ExportableApplication {
  applicationNo: string;
  status: string;
  legacyId: string | null;
  firstName: string | null;
  phone: string | null;
  email: string | null;
  profession: string | null;
  professionOther: string | null;
  businessName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  dob: string | null;
  bloodGroup: string | null;
  aadhaarLast4: string | null;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineePhone: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  rejectionReason: string | null;
}

/**
 * Columns, in file order. Unlike the members export these are human labels,
 * not importer keys: an application export is a report, never re-imported.
 * `tabs` limits a column to the tabs where it can hold a value, so the
 * pending file has no permanently-empty "Reviewed" columns.
 */
const COLUMNS: {
  label: string;
  value: (a: ExportableApplication) => string;
  tabs?: readonly ApplicationTab[];
}[] = [
  { label: "Application No.", value: (a) => a.applicationNo },
  { label: "Status", value: (a) => a.status },
  { label: "Membership No. (ledger)", value: (a) => a.legacyId ?? "" },
  { label: "Full name", value: (a) => fullName(a.firstName) },
  { label: "Phone", value: (a) => a.phone ?? "" },
  { label: "Email", value: (a) => a.email ?? "" },
  {
    label: "Profession",
    value: (a) => professionLabel(a.profession, a.professionOther) ?? "",
  },
  { label: "Business name", value: (a) => a.businessName ?? "" },
  { label: "Address line 1", value: (a) => a.addressLine1 ?? "" },
  { label: "Address line 2", value: (a) => a.addressLine2 ?? "" },
  { label: "Area", value: (a) => a.area ?? "" },
  { label: "City", value: (a) => a.city ?? "" },
  { label: "State", value: (a) => a.state ?? "" },
  { label: "Pincode", value: (a) => a.pincode ?? "" },
  { label: "Date of birth", value: (a) => (a.dob ? isoToDisplay(a.dob) : "") },
  { label: "Blood group", value: (a) => a.bloodGroup ?? "" },
  // Masked, as everywhere else — the full number is encrypted at rest and
  // this module has no way to decrypt it.
  {
    label: "Aadhaar (last 4)",
    value: (a) => (a.aadhaarLast4 ? `•••• •••• ${a.aadhaarLast4}` : ""),
  },
  { label: "Nominee name", value: (a) => a.nomineeName ?? "" },
  { label: "Nominee relationship", value: (a) => a.nomineeRelationship ?? "" },
  { label: "Nominee phone", value: (a) => a.nomineePhone ?? "" },
  { label: "Submitted", value: (a) => formatDateTimeIST(a.createdAt) },
  {
    label: "Reviewed",
    value: (a) => (a.reviewedAt ? formatDateTimeIST(a.reviewedAt) : ""),
    tabs: ["approved", "rejected"],
  },
  {
    label: "Reviewed by",
    value: (a) => a.reviewerName || a.reviewerEmail || "",
    tabs: ["approved", "rejected"],
  },
  {
    label: "Rejection reason",
    value: (a) => a.rejectionReason ?? "",
    tabs: ["rejected"],
  },
];

/** Header labels for `tab`'s export, in file order. Exposed for tests. */
export function applicationCsvHeaders(tab: ApplicationTab): string[] {
  return COLUMNS.filter((c) => !c.tabs || c.tabs.includes(tab)).map(
    (c) => c.label,
  );
}

/** Serialise one queue tab's applications to CSV. */
export function applicationsToCsv(
  applications: ExportableApplication[],
  tab: ApplicationTab,
): string {
  const columns = COLUMNS.filter((c) => !c.tabs || c.tabs.includes(tab));
  // Formula-escaped on the way out, same as the members export: a submitted
  // name like `=HYPERLINK(...)` must not execute when the file is opened.
  const data = applications.map((a) =>
    columns.map((c) => escapeCsvCell(c.value(a))),
  );
  return Papa.unparse(
    { fields: columns.map((c) => c.label), data },
    { newline: "\n" },
  );
}
