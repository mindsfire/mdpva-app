/**
 * Column layout shared by MemberTable and MemberTableSkeleton.
 *
 * Both tables are `table-fixed` with these widths, so a column sits in the
 * same place whatever its contents and the columns don't jump when the real
 * rows replace the skeleton. Name is the one flexible column; the minimum
 * table width keeps it readable, and the table scrolls sideways (with
 * Membership No. and Name pinned) when the drawer leaves less room.
 *
 * Membership No. is `w-36 min-w-36` because the pinned Name column's `left`
 * offset is computed from it — see MemberTable.
 */
export const MEMBER_TABLE_CLASS = "min-w-[960px] table-fixed";

export const MEMBER_COLUMN_CLASS = {
  checkbox: "w-10 min-w-10",
  membership: "w-36 min-w-36",
  name: undefined,
  phone: "w-32",
  profession: "w-36",
  status: "w-24",
  fees: "w-24",
  deathFund: "w-28",
} as const;

/** Header labels after the two pinned, sortable columns. */
export const MEMBER_PLAIN_COLUMNS = [
  { label: "Phone", className: MEMBER_COLUMN_CLASS.phone },
  { label: "Profession", className: MEMBER_COLUMN_CLASS.profession },
  { label: "Status", className: MEMBER_COLUMN_CLASS.status },
  { label: "Fees", className: MEMBER_COLUMN_CLASS.fees },
  { label: "Death Fund", className: MEMBER_COLUMN_CLASS.deathFund },
] as const;
