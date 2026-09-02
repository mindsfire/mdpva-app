/**
 * Remembered CSV-export field selection.
 *
 * Same rule as `sidebar-prefs` / `peek-prefs`: a plain constant module, NOT
 * `"use client"`, so the server page reads the real cookie name rather than a
 * client-reference proxy when it calls `cookies().get(...)`.
 */
import {
  ALL_EXPORT_FIELDS,
  type ExportFieldKey,
} from "@/lib/csv/member-csv";

export const EXPORT_FIELDS_COOKIE = "member_export_fields";
export const EXPORT_FIELDS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const VALID_KEYS = new Set<string>(ALL_EXPORT_FIELDS);

/**
 * Parse the comma-separated cookie into a validated, canonically-ordered list
 * of field keys. Unknown keys (a renamed column, a tampered cookie) are
 * dropped; if nothing valid survives, returns `undefined` so the caller falls
 * back to "all fields" rather than an empty, useless export.
 */
export function parseExportFieldsCookie(
  value: string | undefined,
): ExportFieldKey[] | undefined {
  if (!value) return undefined;
  const chosen = new Set(
    value.split(",").filter((k): k is ExportFieldKey => VALID_KEYS.has(k)),
  );
  if (chosen.size === 0) return undefined;
  // Reorder to the canonical field order so the remembered selection can never
  // reorder the file, regardless of how the cookie was written.
  return ALL_EXPORT_FIELDS.filter((k) => chosen.has(k));
}
