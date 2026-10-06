/**
 * Column layout shared by QueueTable and QueueTableSkeleton.
 *
 * Both tables are `table-fixed` with these widths, so a column sits in the
 * same place whatever its contents — that is what stops the columns jumping
 * when the real rows replace the skeleton. Member is the one flexible
 * column; the minimum table width keeps it usable on narrow screens, where
 * the table scrolls sideways instead.
 */
export const QUEUE_TABLE_CLASS = "min-w-[1180px] table-fixed";
export const QUEUE_CHECKBOX_COLUMN_CLASS = "w-10";

export const QUEUE_COLUMNS = [
  { label: "Photo", className: "w-16" },
  { label: "Application", className: "w-48" },
  { label: "Member", className: undefined },
  { label: "Phone", className: "w-40" },
  { label: "Ledger no.", className: "w-28" },
  { label: "Aadhaar", className: "w-36" },
  { label: "Submitted", className: "w-56" },
  { label: "Status", className: "w-28" },
] as const;
