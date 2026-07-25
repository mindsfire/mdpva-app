"use server";

import { revalidatePath } from "next/cache";
import { inArray, isNull, or, sql, and, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { generateMemberId } from "@/lib/member-id";
import { memberInputSchema, type MemberInput } from "@/lib/validation/member";
import {
  parseMembersCsv,
  type CsvRowError,
} from "@/lib/csv/member-csv";

const MAX_IMPORT_ROWS = 5000;
const INSERT_CHUNK = 100;

export interface DryRunDuplicate {
  row: number;
  name: string;
  field: "email" | "phone" | "legacyId";
  value: string;
  /** true = clashes with an existing db member; false = clashes within the file. */
  existing: boolean;
}

export interface DryRunReport {
  ok: true;
  total: number;
  valid: MemberInput[];
  validRows: number[];
  errors: CsvRowError[];
  duplicates: DryRunDuplicate[];
  unknownHeaders: string[];
  missingHeaders: string[];
}

export interface ImportFailure {
  ok: false;
  error: string;
}

/**
 * Admin. Parses + validates the CSV and checks duplicates against both the
 * file itself and existing (non-deleted) members. Inserts nothing. Rows
 * with duplicates are excluded from `valid` — importing the rest is safe.
 */
export async function dryRunImport(
  csvText: string,
): Promise<DryRunReport | ImportFailure> {
  await requireRole("admin");

  if (csvText.length > 10 * 1024 * 1024) {
    return { ok: false, error: "File too large — 10 MB maximum." };
  }

  const parsed = parseMembersCsv(csvText);
  if (parsed.missingHeaders.length > 0) {
    return {
      ok: false,
      error: `Missing required columns: ${parsed.missingHeaders.join(", ")}. Download the template to see the expected format.`,
    };
  }
  if (parsed.rows.length + parsed.errors.length === 0) {
    return { ok: false, error: "No data rows found in the file." };
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Too many rows — ${MAX_IMPORT_ROWS} maximum per import.` };
  }

  const duplicates = await findDuplicates(parsed.rows);
  const duplicateRows = new Set(duplicates.map((d) => d.row));
  const clean = parsed.rows.filter((r) => !duplicateRows.has(r.row));

  return {
    ok: true,
    total: parsed.rows.length + new Set(parsed.errors.map((e) => e.row)).size,
    valid: clean.map((r) => r.input),
    validRows: clean.map((r) => r.row),
    errors: parsed.errors,
    duplicates,
    unknownHeaders: parsed.unknownHeaders,
    missingHeaders: parsed.missingHeaders,
  };
}

async function findDuplicates(
  rows: { row: number; input: MemberInput }[],
): Promise<DryRunDuplicate[]> {
  const duplicates: DryRunDuplicate[] = [];

  const seen = {
    email: new Map<string, number>(),
    phone: new Map<string, number>(),
    legacyId: new Map<string, number>(),
  };
  for (const { row, input } of rows) {
    const name = `${input.firstName} ${input.lastName}`;
    for (const field of ["email", "phone", "legacyId"] as const) {
      const raw = input[field];
      if (!raw) continue;
      const value = field === "email" ? raw.toLowerCase() : raw;
      const firstRow = seen[field].get(value);
      if (firstRow !== undefined) {
        duplicates.push({ row, name, field, value: raw, existing: false });
      } else {
        seen[field].set(value, row);
      }
    }
  }

  const emails = [...seen.email.keys()];
  const phones = [...seen.phone.keys()];
  const legacyIds = [...seen.legacyId.keys()];
  const conditions: SQL[] = [];
  if (emails.length) conditions.push(inArray(sql`lower(${members.email})`, emails));
  if (phones.length) conditions.push(inArray(members.phone, phones));
  if (legacyIds.length) conditions.push(inArray(members.legacyId, legacyIds));
  if (conditions.length === 0) return duplicates;

  const existing = await db
    .select({ email: members.email, phone: members.phone, legacyId: members.legacyId })
    .from(members)
    .where(and(isNull(members.deletedAt), or(...conditions)));

  const existingEmail = new Set(
    existing.map((m) => m.email?.toLowerCase()).filter(Boolean) as string[],
  );
  const existingPhone = new Set(existing.map((m) => m.phone).filter(Boolean) as string[]);
  const existingLegacy = new Set(existing.map((m) => m.legacyId).filter(Boolean) as string[]);

  for (const { row, input } of rows) {
    const name = `${input.firstName} ${input.lastName}`;
    if (input.email && existingEmail.has(input.email.toLowerCase())) {
      duplicates.push({ row, name, field: "email", value: input.email, existing: true });
    }
    if (input.phone && existingPhone.has(input.phone)) {
      duplicates.push({ row, name, field: "phone", value: input.phone, existing: true });
    }
    if (input.legacyId && existingLegacy.has(input.legacyId)) {
      duplicates.push({ row, name, field: "legacyId", value: input.legacyId, existing: true });
    }
  }

  return duplicates;
}

export interface CommitResult {
  ok: true;
  inserted: number;
}

/**
 * Admin. Re-validates and re-checks duplicates server-side (the client
 * payload is untrusted and the db may have changed since the dry run),
 * then inserts in chunks with sequence-generated member IDs.
 */
export async function commitImport(
  inputs: unknown[],
): Promise<CommitResult | ImportFailure> {
  const sessionUser = await requireRole("admin");

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: "Nothing to import." };
  }
  if (inputs.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Too many rows — ${MAX_IMPORT_ROWS} maximum per import.` };
  }

  const validated: MemberInput[] = [];
  for (const raw of inputs) {
    const parsed = memberInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Import payload failed validation — re-run the preview." };
    }
    validated.push(parsed.data);
  }

  const duplicates = await findDuplicates(
    validated.map((input, i) => ({ row: i + 1, input })),
  );
  if (duplicates.length > 0) {
    return {
      ok: false,
      error: `${duplicates.length} duplicate value(s) detected — the data changed since the preview. Re-run it.`,
    };
  }

  const year = new Date().getFullYear();
  const seq = await db.execute<{ nextval: string }>(
    sql`select nextval('members_seq') as nextval from generate_series(1, ${validated.length})`,
  );
  const memberIds = seq.rows.map((r) => generateMemberId(year, Number(r.nextval)));

  let inserted = 0;
  for (let i = 0; i < validated.length; i += INSERT_CHUNK) {
    const chunk = validated.slice(i, i + INSERT_CHUNK).map((input, j) => ({
      memberId: memberIds[i + j],
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      profession: input.profession,
      businessName: input.businessName,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      area: input.area,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      dob: input.dob,
      bloodGroup: input.bloodGroup,
      status: input.status,
      feesPaidUpto: input.feesPaidUpto,
      deathFundCovered: input.deathFundCovered,
      notes: input.notes,
      legacyId: input.legacyId,
      createdBy: sessionUser.id,
      updatedBy: sessionUser.id,
    }));
    await db.insert(members).values(chunk);
    inserted += chunk.length;
  }

  revalidatePath("/members");
  revalidatePath("/");
  return { ok: true, inserted };
}
