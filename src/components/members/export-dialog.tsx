"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ALL_EXPORT_FIELDS,
  EXPORT_FIELDS,
  IMPORT_REQUIRED_FIELDS,
  type ExportFieldKey,
} from "@/lib/csv/member-csv";
import {
  EXPORT_FIELDS_COOKIE,
  EXPORT_FIELDS_COOKIE_MAX_AGE,
} from "@/lib/export-prefs";

const FIELD_LABEL = new Map(EXPORT_FIELDS.map((f) => [f.key, f.label]));

/** Build the export URL from the active filters plus the chosen fields. */
function buildExportUrl(
  currentParams: Record<string, string | undefined>,
  fields: ExportFieldKey[],
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value) params.set(key, value);
  }
  params.set("fields", fields.join(","));
  return `/api/export/members?${params.toString()}`;
}

/**
 * CSV export field picker. Replaces the direct download link: staff choose
 * which columns to include, and the selection is remembered in a cookie for
 * next time. Filters currently applied to the directory are carried through
 * `currentParams`, so it still exports exactly what is on screen.
 */
export function ExportCsvDialog({
  initialFields,
  currentParams,
}: {
  initialFields: ExportFieldKey[];
  currentParams: Record<string, string | undefined>;
}) {
  const [open, setOpen] = React.useState(false);
  // The selection to fall back to when the dialog is dismissed without
  // exporting — the last successfully exported set, or `initialFields` (the
  // remembered cookie) before the first export. A plain prop wouldn't do:
  // it only updates on a server round-trip, so it can't reflect an export
  // that just happened in this same client session.
  const baselineRef = React.useRef<ExportFieldKey[]>(initialFields);
  // Seeded from the prop directly, not the ref: on mount they're identical,
  // and reading a ref's `.current` inside a state initializer runs during
  // render, which react-hooks/refs rightly flags.
  const [selected, setSelected] = React.useState<Set<ExportFieldKey>>(
    () => new Set(initialFields),
  );

  // Cancel, Esc, and an outside click all flow through here (same
  // `open`/`onOpenChange` wiring `DialogClose` uses elsewhere in the app) —
  // any of them discards unsaved toggles rather than leaving them to reappear
  // next time the dialog opens.
  function handleOpenChange(next: boolean) {
    if (!next) setSelected(new Set(baselineRef.current));
    setOpen(next);
  }

  function toggle(key: ExportFieldKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allChecked = selected.size === ALL_EXPORT_FIELDS.length;
  const noneChecked = selected.size === 0;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(ALL_EXPORT_FIELDS));
  }

  // Canonical order, so the remembered cookie and the file both stay ordered.
  const chosen = ALL_EXPORT_FIELDS.filter((k) => selected.has(k));
  const missingRequired = IMPORT_REQUIRED_FIELDS.filter((k) => !selected.has(k));

  function handleExport() {
    document.cookie = `${EXPORT_FIELDS_COOKIE}=${chosen.join(",")}; path=/; max-age=${EXPORT_FIELDS_COOKIE_MAX_AGE}; SameSite=Lax`;

    // A programmatic anchor triggers the download in place, without navigating
    // away from the directory — the route sends Content-Disposition attachment.
    const a = document.createElement("a");
    a.href = buildExportUrl(currentParams, chosen);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Commit this as the new fallback so a later Cancel discards back to it,
    // not to whatever was remembered when the dialog first opened.
    baselineRef.current = chosen;
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export members</DialogTitle>
          <DialogDescription>
            Choose the columns to include. Rows are exported in membership-number
            order and match any filters currently applied.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-mdpva-border pb-2 dark:border-border">
          <Checkbox
            id="export-all"
            checked={allChecked}
            indeterminate={!allChecked && !noneChecked}
            onCheckedChange={toggleAll}
          />
          <Label htmlFor="export-all" className="cursor-pointer">
            {allChecked ? "Clear all" : "Select all"}
          </Label>
        </div>

        <div className="grid max-h-[45vh] grid-cols-1 gap-x-4 gap-y-2.5 overflow-y-auto sm:grid-cols-2">
          {EXPORT_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <Checkbox
                id={`export-${field.key}`}
                checked={selected.has(field.key)}
                onCheckedChange={() => toggle(field.key)}
              />
              <Label
                htmlFor={`export-${field.key}`}
                className="cursor-pointer font-normal"
              >
                {field.label}
              </Label>
            </div>
          ))}
        </div>

        {missingRequired.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            This selection can&apos;t be re-imported — it is missing{" "}
            {missingRequired.map((k) => FIELD_LABEL.get(k)).join(", ")}.
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button type="button" onClick={handleExport} disabled={noneChecked}>
            <DownloadIcon />
            Export {selected.size} field{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
