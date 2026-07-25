import { z } from "zod";

const PINCODE_REGEX = /^[0-9]{6}$/;

/** Empty/whitespace-only strings (and null/undefined) collapse to `null`. */
function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const optionalTrimmedString = z
  .string()
  .optional()
  .nullable()
  .transform(trimOrNull);

/**
 * Shared client/server schema for the editable member fields (spec §4).
 * `member_id` is server-generated (see `generateMemberId`) and intentionally
 * excluded — never accept it as user input.
 */
export const memberInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),

  email: z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Enter a valid email",
    }),
  phone: optionalTrimmedString,

  profession: z
    .enum(["photographer", "videographer", "both"])
    .nullable()
    .default(null),
  businessName: optionalTrimmedString,

  addressLine1: z.string().trim().min(1, "Address is required"),
  addressLine2: optionalTrimmedString,
  area: optionalTrimmedString,
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: z
    .string()
    .optional()
    .nullable()
    .transform(trimOrNull)
    .refine((v) => v === null || PINCODE_REGEX.test(v), {
      message: "Pincode must be 6 digits",
    }),

  dob: optionalTrimmedString,
  bloodGroup: optionalTrimmedString,

  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  feesPaidUpto: z.number().int().nullable().default(null),
  deathFundCovered: z.boolean().default(false),

  notes: optionalTrimmedString,
  legacyId: optionalTrimmedString,
});

export type MemberInput = z.infer<typeof memberInputSchema>;
