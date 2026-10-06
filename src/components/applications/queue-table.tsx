"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { bulkApproveApplications } from "@/app/actions/applications";
import type { QueueRow } from "@/app/actions/applications";
import { ReopenForResubmitAction } from "@/components/applications/reopen-action";
import { Button } from "@/components/ui/button";
import { maskAadhaar } from "@/lib/validation/aadhaar";
import { formatPhone, normalizePhone } from "@/lib/validation/phone";
import { applicationPhoto } from "@/lib/application-photo";
import { formatDateTimeIST } from "@/lib/format-date";
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
import { PhotoImg } from "@/components/photo-img";
import { SearchHighlight } from "@/components/search-highlight";
import {
  QUEUE_CHECKBOX_COLUMN_CLASS,
  QUEUE_COLUMNS,
  QUEUE_TABLE_CLASS,
} from "@/components/applications/queue-columns";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-mdpva-gold/25 text-mdpva-accent dark:text-mdpva-gold",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive-soft text-destructive",
  superseded: "bg-muted text-muted-foreground",
};

/**
 * The name a queue row shows. Once approved, the member record is the source
 * of truth — an admin may have corrected a typo there — so the approved tab
 * shows the live name; until then, what was submitted is what's under review.
 */
function queueName(row: QueueRow): string {
  return row.status === "approved" ? row.currentName : row.submittedName;
}

/**
 * Copies a row's phone number without opening the application (the row
 * itself is a link). Copies the bare 10 digits — what a dialer or WhatsApp
 * expects — falling back to the stored text for a number that won't
 * normalize, such as an old ledger landline.
 */
function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(normalizePhone(phone) ?? phone.trim());
      setCopied(true);
      toast.success("Phone number copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the phone number.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      aria-label={`Copy phone number ${formatPhone(phone)}`}
      title="Copy phone number"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

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
        <Table className={QUEUE_TABLE_CLASS}>
          <TableHeader>
            <TableRow>
              {selectable ? (
                <TableHead className={QUEUE_CHECKBOX_COLUMN_CLASS}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
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
                  {(() => {
                    const photo = applicationPhoto(row, {
                      photoKey: row.memberPhotoKey,
                      updatedAt: row.memberUpdatedAt,
                    });
                    return photo.kind === "photo" ? (
                      <PhotoImg
                        src={photo.src}
                        alt=""
                        className="h-12 w-[37px] rounded-sm object-cover"
                        fallback={
                          <span
                            className="flex h-12 w-[37px] items-center justify-center rounded-sm border border-dashed border-border text-center text-[9px] leading-tight text-muted-foreground"
                            title="Photo file is missing"
                          >
                            missing
                          </span>
                        }
                      />
                    ) : (
                      <span
                        className="flex h-12 w-[37px] items-center justify-center rounded-sm border border-dashed border-border text-center text-[9px] leading-tight text-muted-foreground"
                        title={
                          photo.kind === "unavailable"
                            ? "Photo removed when this application was rejected"
                            : undefined
                        }
                      >
                        {photo.kind === "unavailable" ? "removed" : "none"}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="font-medium tabular-nums text-foreground">
                  <div className="flex items-center gap-1.5">
                    <SearchHighlight text={row.applicationNo} />
                    {row.status === "approved" ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${row.applicationNo} as PDF`}
                        onClick={(e) => e.stopPropagation()}
                        render={<a href={`/api/applications/${row.id}/pdf`} />}
                      >
                        <DownloadIcon />
                      </Button>
                    ) : null}
                    {row.status === "approved" || row.status === "rejected" ? (
                      <ReopenForResubmitAction
                        applicationId={row.id}
                        applicationNo={row.applicationNo}
                        iconOnly
                      />
                    ) : null}
                  </div>
                </TableCell>
                {/* The one flexible column: long names truncate rather than
                    spill into the next column under table-fixed. */}
                <TableCell className="truncate" title={queueName(row)}>
                  <SearchHighlight text={queueName(row)} />
                  {row.editedAt ? (
                    <span
                      className="ml-2 rounded-full bg-mdpva-gold/25 px-1.5 py-0.5 align-middle text-[10.5px] font-medium text-mdpva-accent dark:text-mdpva-gold"
                      title={`Corrected by an admin · ${formatDateTimeIST(row.editedAt)}`}
                    >
                      Edited
                    </span>
                  ) : null}
                  {queueName(row) !== row.submittedName ? (
                    <div className="truncate text-xs text-muted-foreground">
                      submitted as <SearchHighlight text={row.submittedName} />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.phone ? (
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={formatPhone(row.phone)}>
                        <SearchHighlight text={formatPhone(row.phone)} />
                      </span>
                      <CopyPhoneButton phone={row.phone} />
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.legacyId ? <SearchHighlight text={row.legacyId} /> : "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.aadhaarLast4 ? (
                    <SearchHighlight text={maskAadhaar(row.aadhaarLast4)} />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTimeIST(row.createdAt)}
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
