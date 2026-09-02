import { z } from "zod";

import { normalizePhone } from "./phone";
import {
  graphemeLength,
  isValidBusinessName,
  isValidPersonName,
  sanitizeName,
  sanitizeText,
} from "./text-safety";

const PINCODE_REGEX = /^[0-9]{6}$/;

/**
 * Field length caps, in graphemes (what a human sees), not UTF-16 code units.
 *
 * Before these existed the schema had no upper bound on any field at all — a
 * multi-megabyte name was accepted, stored, rendered into every directory row,
 * and written into CSV exports.
 */
export const MAX_LENGTHS = {
  name: 60,
  email: 254, // RFC 5321
  businessName: 120,
  addressLine: 120,
  area: 60,
  city: 60,
  state: 60,
  dob: 10,
  bloodGroup: 4,
  notes: 2000,
  legacyId: 20,
} as const;

/** Empty/whitespace-only strings (and null/undefined) collapse to `null`. */
function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = sanitizeText(value);
  return cleaned === "" ? null : cleaned;
}

/** Optional free text: sanitized, nulled when empty, capped. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .refine((v) => v === null || graphemeLength(v) <= max, {
      message: `${label} must be ${max} characters or fewer`,
    });
}

/** Required free text: sanitized, non-empty, capped. */
function requiredText(max: number, label: string) {
  return z
    .string()
    .transform((v) => sanitizeText(v))
    .refine((v) => v.length > 0, { message: `${label} is required` })
    .refine((v) => graphemeLength(v) <= max, {
      message: `${label} must be ${max} characters or fewer`,
    });
}

/**
 * A person's name. Sanitized with combining-mark limiting (not just
 * `sanitizeText`) and restricted to letters from any script plus the
 * punctuation Indian names genuinely use — so Kannada works, but digits,
 * symbols and markup do not.
 */
function personName(label: string) {
  return z
    .string()
    .transform((v) => sanitizeName(v))
    .refine((v) => v.length > 0, { message: `${label} is required` })
    .refine((v) => graphemeLength(v) <= MAX_LENGTHS.name, {
      message: `${label} must be ${MAX_LENGTHS.name} characters or fewer`,
    })
    .refine(isValidPersonName, {
      message: `${label} may only contain letters, spaces and . ' -`,
    });
}

/**
 * A name part that may legitimately be absent.
 *
 * Kannada names frequently have no separable surname — 484 of the 1360 legacy
 * ledger members are recorded as a single name ("SHIVAKUMAR") or as initials
 * carrying the family part up front ("P.V. ANILKUMAR"). Requiring a last name
 * would mean inventing one for 37% of the membership, so it is optional and
 * normalises to `null` rather than "".
 */
function optionalPersonName(label: string) {
  return z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      const cleaned = sanitizeName(v ?? "");
      return cleaned.length > 0 ? cleaned : null;
    })
    .refine((v) => v === null || graphemeLength(v) <= MAX_LENGTHS.name, {
      message: `${label} must be ${MAX_LENGTHS.name} characters or fewer`,
    })
    .refine((v) => v === null || isValidPersonName(v), {
      message: `${label} may only contain letters, spaces and . ' -`,
    });
}

/**
 * Shared client/server schema for the editable member fields (spec §4).
 * `member_id` is server-generated (see `generateMemberId`) and intentionally
 * excluded — never accept it as user input.
 */
export const memberInputSchema = z.object({
  firstName: personName("First name"),
  lastName: optionalPersonName("Last name"),

  email: z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .transform((v) => (v === null ? null : v.toLowerCase()))
    .refine((v) => v === null || graphemeLength(v) <= MAX_LENGTHS.email, {
      message: "Email is too long",
    })
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Enter a valid email",
    }),

  /**
   * Stored as the member wrote it; `normalizePhone` is what every comparison
   * uses. Rejected outright when it can't be a real Indian mobile number —
   * onboarding verification matches on this field, so junk here would let the
   * wrong person claim a record.
   */
  phone: z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .refine((v) => v === null || normalizePhone(v) !== null, {
      message: "Enter a valid 10-digit mobile number",
    }),

  profession: z
    .enum(["photographer", "videographer", "both", "drone_operator"])
    .nullable()
    .default(null),
  businessName: optionalText(
    MAX_LENGTHS.businessName,
    "Business name",
  ).refine((v) => v === null || isValidBusinessName(v), {
    message: "Business name contains characters that aren't allowed",
  }),

  addressLine1: requiredText(MAX_LENGTHS.addressLine, "Address"),
  addressLine2: optionalText(MAX_LENGTHS.addressLine, "Address line 2"),
  area: optionalText(MAX_LENGTHS.area, "Area"),
  city: requiredText(MAX_LENGTHS.city, "City"),
  state: requiredText(MAX_LENGTHS.state, "State"),
  pincode: z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .refine((v) => v === null || PINCODE_REGEX.test(v), {
      message: "Pincode must be 6 digits",
    }),

  dob: optionalText(MAX_LENGTHS.dob, "Date of birth"),
  bloodGroup: optionalText(MAX_LENGTHS.bloodGroup, "Blood group"),

  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  feesPaidUpto: z.number().int().nullable().default(null),
  deathFundCovered: z.boolean().default(false),

  notes: optionalText(MAX_LENGTHS.notes, "Notes"),
  legacyId: optionalText(MAX_LENGTHS.legacyId, "Membership No."),
});

export type MemberInput = z.infer<typeof memberInputSchema>;
