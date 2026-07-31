import type { MemberDetail } from "@/lib/members-query";

export interface DetailField {
  label: string;
  /** `null` means "recorded as empty" — callers render an em-dash. */
  value: string | number | null;
}

export interface MemberSection {
  title: string;
  fields: DetailField[];
}

export const PROFESSION_LABELS: Record<
  NonNullable<MemberDetail["profession"]>,
  string
> = {
  photographer: "Photographer",
  videographer: "Videographer",
  both: "Photo & Video",
};

/**
 * The drawer's field list, as data.
 *
 * Extracted from the component for the same reason `buildMembersWhere` was
 * extracted from `searchMembers`: it makes the mapping testable in this
 * project's node test environment, with no jsdom or testing-library.
 *
 * Every field is listed unconditionally. Empty values are `null` rather than
 * omitted — a member with nothing filled in must still show every row, or
 * "empty" becomes indistinguishable from "not shown here", which is exactly
 * the confusion this redesign exists to fix.
 */
export function buildMemberSections(member: MemberDetail): MemberSection[] {
  return [
    {
      title: "Contact",
      fields: [
        { label: "Email", value: member.email },
        { label: "Phone", value: member.phone },
      ],
    },
    {
      title: "Address",
      fields: [
        { label: "Address line 1", value: member.addressLine1 },
        { label: "Address line 2", value: member.addressLine2 },
        { label: "Area", value: member.area },
        { label: "City", value: member.city },
        { label: "State", value: member.state },
        { label: "Pincode", value: member.pincode },
      ],
    },
    {
      title: "Association",
      fields: [
        {
          label: "Profession",
          value: member.profession
            ? PROFESSION_LABELS[member.profession]
            : null,
        },
        { label: "Business", value: member.businessName },
        { label: "Date of birth", value: member.dob },
        { label: "Blood group", value: member.bloodGroup },
        { label: "Fees paid upto", value: member.feesPaidUpto },
        {
          label: "Death fund",
          value: member.deathFundCovered ? "Covered" : "Not covered",
        },
      ],
    },
    {
      title: "Notes",
      fields: [{ label: "Notes", value: member.notes }],
    },
  ];
}
