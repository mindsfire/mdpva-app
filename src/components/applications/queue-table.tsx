"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { bulkApproveApplications } from "@/app/actions/applications";
import type { QueueRow } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-mdpva-gold/25 text-mdpva-accent dark:text-mdpva-gold",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive-soft text-destructive",
  superseded: "bg-muted text-muted-foreground",
};

/**
 * The review queue.
 *
 * Every row shows the submitted photo, which is what makes bulk approve
 * defensible: the admin has already looked at each photo they're accepting.
 * Without the thumbnail this would be approving sight-unseen.
 */
export function QueueTable({
  rows,
  selectable,
}: {
  rows: QueueRow[];
  selectable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Drop selections for rows no longer in the list (tab or refresh change).
  const idSet = React.useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const [prevIds, setPrevIds] = React.useState(idSet);
  if (idSet !== prevIds) {
    setPrevIds(idSet);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => idSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function onBulkApprove() {
    setPending(true);
    try {
      const result = await bulkApproveApplications([...selected]);
      if (result.skipped > 0) {
        toast.warning(
          `${result.approved} approved, ${result.skipped} already reviewed by someone else.`,
        );
      } else {
        toast.success(
          result.approved === 1
            ? "1 application approved."
            : `${result.approved} applications approved.`,
        );
      }
      setSelected(new Set());
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-mdpva-border py-16 text-center text-muted-foreground dark:border-border">
        Nothing here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-mdpva-border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              ) : null}
              <TableHead className="w-16">Photo</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Ledger no.</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/applications/${row.id}`)}
              >
                {selectable ? (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                      aria-label={`Select ${row.applicationNo}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  {row.photoKey ? (
                    // eslint-disable-next-line @next/next/no-img-element -- auth-gated stream from R2, not a static asset
                    <img
                      src={`/api/photos/${row.photoKey}`}
                      alt=""
                      className="h-12 w-[37px] rounded-sm object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-[37px] items-center justify-center rounded-sm border border-dashed border-border text-[9px] text-muted-foreground">
                      none
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium tabular-nums text-foreground">
                  {row.applicationNo}
                </TableCell>
                <TableCell>{row.submittedName}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.legacyId ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFmt.format(row.createdAt)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLES[row.status],
                    )}
                  >
                    {row.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectable && selected.size > 0 ? (
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-lg border border-mdpva-border bg-popover px-4 py-2.5 shadow-md ring-1 ring-foreground/10 dark:border-border">
          <span className="text-sm">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              <CheckIcon />
              Approve selected
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {selected.size} applications?</DialogTitle>
            <DialogDescription>
              Each member&apos;s record and photo will be updated with what they
              submitted. This writes to the directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={onBulkApprove} disabled={pending}>
              {pending ? "…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
