import { z } from "zod";

import { normalizePhone } from "./phone";
import {
  graphemeLength,
  isValidBusinessName,
  isValidPersonName,
  sanitizeName,
  sanitizeText,
} from "./text-safety";
import { MAX_LENGTHS } from "./member";

/**
 * What a member may submit about themselves.
 *
 * Deliberately a subset of `memberInputSchema`: `status`, `feesPaidUpto`,
 * `deathFundCovered`, `notes`, `legacyId` and `memberId` are association-
 * controlled and must never be member-editable. Modelling that as a separate
 * schema rather than a `.pick()` means adding a field to the admin form can't
 * silently open it to the public form.
 *
 * Shares the sanitizers and caps, so the character-abuse defences apply
 * identically on both paths.
 */

const PINCODE_REGEX = /^[0-9]{6}$/;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeText(value);
  return cleaned === "" ? null : cleaned;
}

function optionalText(max: number, label: string) {
  return z
    .unknown()
    .transform(trimOrNull)
    .refine((v) => v === null || graphemeLength(v) <= max, {
      message: `${label} must be ${max} characters or fewer`,
    });
}

function personName(label: string) {
  return z
    .unknown()
    .transform((v) => (typeof v === "string" ? sanitizeName(v) : ""))
    .refine((v) => v.length > 0, { message: `${label} is required` })
    .refine((v) => graphemeLength(v) <= MAX_LENGTHS.name, {
      message: `${label} must be ${MAX_LENGTHS.name} characters or fewer`,
    })
    .refine(isValidPersonName, {
      message: `${label} may only contain letters, spaces and . ' -`,
    });
}

function requiredText(max: number, label: string) {
  return z
    .unknown()
    .transform((v) => (typeof v === "string" ? sanitizeText(v) : ""))
    .refine((v) => v.length > 0, { message: `${label} is required` })
    .refine((v) => graphemeLength(v) <= max, {
      message: `${label} must be ${max} characters or fewer`,
    });
}

/** Birth dates outside this range are typos, not data. */
const MIN_AGE = 18;
const MAX_AGE = 100;

export const applicationInputSchema = z.object({
  firstName: personName("First name"),
  lastName: personName("Last name"),

  phone: z
    .unknown()
    .transform(trimOrNull)
    .refine((v) => v !== null, { message: "Phone number is required" })
    .refine((v) => v === null || normalizePhone(v) !== null, {
      message: "Enter a valid 10-digit mobile number",
    }),

  email: optionalText(MAX_LENGTHS.email, "Email")
    .transform((v) => (v === null ? null : v.toLowerCase()))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),

  addressLine1: requiredText(MAX_LENGTHS.addressLine, "Address"),
  addressLine2: optionalText(MAX_LENGTHS.addressLine, "Address line 2"),
  area: optionalText(MAX_LENGTHS.area, "Area"),
  pincode: optionalText(6, "Pincode").refine(
    (v) => v === null || PINCODE_REGEX.test(v),
    { message: "Pincode must be 6 digits" },
  ),
  city: requiredText(MAX_LENGTHS.city, "City"),
  state: requiredText(MAX_LENGTHS.state, "State"),

  profession: z
    .unknown()
    .transform((v) => (typeof v === "string" && v !== "" ? v : null))
    .refine(
      (v) =>
        v === null ||
        ["photographer", "videographer", "both", "drone_operator"].includes(
          v,
        ),
      { message: "Choose the nature of your work" },
    )
    .refine((v) => v !== null, { message: "Choose the nature of your work" })
    .transform(
      (v) =>
        v as "photographer" | "videographer" | "both" | "drone_operator",
    ),

  businessName: optionalText(
    MAX_LENGTHS.businessName,
    "Business name",
  ).refine((v) => v === null || isValidBusinessName(v), {
    message: "Business name contains characters that aren't allowed",
  }),

  /** ISO `YYYY-MM-DD` from the date field; the column is a `date`. */
  dob: optionalText(10, "Date of birth").refine(
    (v) => v === null || isPlausibleBirthDate(v),
    { message: "Enter a valid date of birth" },
  ),

  bloodGroup: optionalText(MAX_LENGTHS.bloodGroup, "Blood group"),
});

function isPlausibleBirthDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return false;
  }
  const now = new Date();
  if (d > now) return false;
  const age = (now.getTime() - d.getTime()) / (365.2425 * 24 * 3600 * 1000);
  return age >= MIN_AGE && age <= MAX_AGE;
}

export type ApplicationInput = z.infer<typeof applicationInputSchema>;
