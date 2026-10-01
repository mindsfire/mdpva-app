import { isProfession, type Profession } from "@/lib/profession";

/**
 * Narrows the nullable DB enum to the form's union, which uses "" for unset.
 *
 * The retired `drone_operator` value isn't a `Profession`, so a member whose
 * existing application somehow had it sees the field as unset and must pick
 * one of the current options — same as if they'd never chosen one.
 */
export function isoToDisplayableProfession(
  value: string | null,
): "" | Profession {
  return isProfession(value) ? value : "";
}
