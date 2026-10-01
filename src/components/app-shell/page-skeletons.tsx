import { ChevronsUpDownIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  QUEUE_CHECKBOX_COLUMN_CLASS,
  QUEUE_COLUMNS,
  QUEUE_TABLE_CLASS,
} from "@/components/applications/queue-columns";
import {
  MEMBER_COLUMN_CLASS,
  MEMBER_PLAIN_COLUMNS,
  MEMBER_TABLE_CLASS,
} from "@/components/members/member-columns";

/**
 * Shared skeleton pieces. Each route's loading.tsx composes these to match
 * that page's real layout — a skeleton whose shape differs from the page
 * that replaces it reads as a broken flash rather than a load.
 */

export function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-3" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function PageHeadingSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withAction ? <Skeleton className="h-7 w-28 rounded-lg" /> : null}
    </div>
  );
}

/** Card matching the bordered section cards used across the app. */
export function CardSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * Mirrors MemberTable. Built from the same Table parts, header labels, row
 * colours and column widths (`member-columns`), so the 40px header, 49px
 * rows (a 32px avatar plus cell padding and border) and every column line up
 * with the table that replaces it.
 */
export function MemberTableSkeleton({
  rows = 8,
  selectable = false,
}: {
  rows?: number;
  selectable?: boolean;
}) {
  return (
    <div className="hidden rounded-lg border border-mdpva-border dark:border-border md:block">
      <Table className={MEMBER_TABLE_CLASS}>
        <TableHeader>
          <TableRow className="bg-mdpva-paper hover:bg-mdpva-paper dark:bg-background dark:hover:bg-background">
            {selectable ? (
              <TableHead className={MEMBER_COLUMN_CLASS.checkbox}>
                <Skeleton className="size-4 rounded-[4px]" />
              </TableHead>
            ) : null}
            <TableHead className={MEMBER_COLUMN_CLASS.membership}>
              <SortableLabelSkeleton label="Membership No." />
            </TableHead>
            <TableHead>
              <SortableLabelSkeleton label="Name" />
            </TableHead>
            {MEMBER_PLAIN_COLUMNS.map((column) => (
              <TableHead key={column.label} className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow
              key={i}
              className="bg-mdpva-white hover:bg-mdpva-white dark:bg-card dark:hover:bg-card"
            >
              {selectable ? (
                <TableCell>
                  <Skeleton className="size-4 rounded-[4px]" />
                </TableCell>
              ) : null}
              <TableCell>
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A sortable header's label and its faint up/down icon, as MemberTable draws them. */
function SortableLabelSkeleton({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 py-1">
      {label}
      <ChevronsUpDownIcon className="size-3.5 opacity-40" />
    </span>
  );
}

/** Mirrors MemberCard: avatar, name and ID, phone and profession, badges. */
export function MemberCardsSkeleton({
  rows = 6,
  selectable = false,
}: {
  rows?: number;
  selectable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 md:hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border border-mdpva-border bg-card p-3.5 dark:border-border"
        >
          {selectable ? (
            <div className="-m-1.5 flex p-1.5">
              <Skeleton className="size-4 rounded-[4px]" />
            </div>
          ) : null}
          <Skeleton className="mt-0.5 size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex h-6 items-center justify-between gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-48" />
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors QueueTable. Built from the same Table parts, header labels and
 * column widths (`queue-columns`), so cell padding, row height (the 48px
 * photo) and column positions match the table that replaces it.
 */
export function QueueTableSkeleton({
  rows = 8,
  selectable = false,
}: {
  rows?: number;
  selectable?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-mdpva-border dark:border-border">
      <Table className={QUEUE_TABLE_CLASS}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className={QUEUE_CHECKBOX_COLUMN_CLASS}>
                <Skeleton className="size-4 rounded-[4px]" />
              </TableHead>
            ) : null}
            {QUEUE_COLUMNS.map((column) => (
              <TableHead key={column.label} className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {selectable ? (
                <TableCell>
                  <Skeleton className="size-4 rounded-[4px]" />
                </TableCell>
              ) : null}
              <TableCell>
                <Skeleton className="h-12 w-[37px] rounded-sm" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Mirrors MembersPagination's summary line and rows-per-page button. */
export function PaginationSkeleton() {
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
    </div>
  );
}
