"use client";

import * as React from "react";
import Link from "next/link";
import {
  UploadIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  CopyXIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  dryRunImport,
  commitImport,
  type DryRunReport,
} from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Phase =
  | { step: "idle" }
  | { step: "parsing" }
  | { step: "preview"; fileName: string; report: DryRunReport }
  | { step: "committing"; fileName: string; report: DryRunReport }
  | { step: "done"; inserted: number };

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  legacyId: "Membership No.",
};

function SummaryPill({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: "ok" | "warn" | "error";
}) {
  const tones = {
    ok: "text-mdpva-accent dark:text-mdpva-gold",
    warn: "text-amber-700 dark:text-amber-400",
    error: "text-red-700 dark:text-red-400",
  } as const;
  return (
    <div className="flex items-center gap-2 rounded-md border border-mdpva-border bg-mdpva-white px-3 py-2 dark:border-border dark:bg-card">
      <Icon className={`size-4 ${tones[tone]}`} />
      <span className="text-sm">
        <span className="font-medium tabular-nums">{count}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

export function ImportView() {
  const [phase, setPhase] = React.useState<Phase>({ step: "idle" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose a .csv file.");
      return;
    }
    setPhase({ step: "parsing" });
    try {
      const text = await file.text();
      const result = await dryRunImport(text);
      if (!result.ok) {
        toast.error(result.error);
        setPhase({ step: "idle" });
        return;
      }
      setPhase({ step: "preview", fileName: file.name, report: result });
    } catch {
      toast.error("Could not read the file — try again.");
      setPhase({ step: "idle" });
    }
  }

  async function handleCommit() {
    if (phase.step !== "preview") return;
    setPhase({ ...phase, step: "committing" });
    const result = await commitImport(phase.report.valid);
    if (!result.ok) {
      toast.error(result.error);
      setPhase({ ...phase, step: "preview" });
      return;
    }
    toast.success(`Imported ${result.inserted} members.`);
    setPhase({ step: "done", inserted: result.inserted });
  }

  function reset() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPhase({ step: "idle" });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Export
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Downloads the full directory as CSV. To export a filtered subset,
          filter on the Members page first, then append its query to the
          export link — or just use this for everything.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" render={<a href="/api/export/members" download />}>
            <FileDownIcon />
            Export all members
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Import
        </h2>

        {phase.step === "idle" || phase.step === "parsing" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a CSV in the template format. Nothing is written until
              you confirm the preview — rows with errors or duplicates are
              listed first.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={phase.step === "parsing"}
              >
                {phase.step === "parsing" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UploadIcon />
                )}
                {phase.step === "parsing" ? "Checking…" : "Choose CSV"}
              </Button>
              <Button variant="ghost" render={<a href="/api/export/template" download />}>
                <FileSpreadsheetIcon />
                Download template
              </Button>
            </div>
          </>
        ) : null}

        {phase.step === "preview" || phase.step === "committing" ? (
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-sm">
              <span className="font-medium">{phase.fileName}</span>{" "}
              <span className="text-muted-foreground">— dry run, nothing imported yet.</span>
            </p>

            <div className="flex flex-wrap gap-2">
              <SummaryPill
                icon={CheckCircle2Icon}
                label="ready to import"
                count={phase.report.valid.length}
                tone="ok"
              />
              <SummaryPill
                icon={CopyXIcon}
                label="duplicates (skipped)"
                count={phase.report.duplicates.length}
                tone="warn"
              />
              <SummaryPill
                icon={AlertTriangleIcon}
                label="rows with errors (skipped)"
                count={new Set(phase.report.errors.map((e) => e.row)).size}
                tone="error"
              />
            </div>

            {phase.report.unknownHeaders.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Ignored columns: {phase.report.unknownHeaders.join(", ")}
              </p>
            ) : null}

            {phase.report.duplicates.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-mdpva-border dark:border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Clashes with</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase.report.duplicates.slice(0, 50).map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">{d.row}</TableCell>
                        <TableCell>{d.name}</TableCell>
                        <TableCell>{FIELD_LABELS[d.field]}</TableCell>
                        <TableCell className="font-mono text-xs">{d.value}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.existing ? "existing member" : "another row in this file"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {phase.report.errors.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-mdpva-border dark:border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Problem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase.report.errors.slice(0, 50).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">{e.row}</TableCell>
                        <TableCell>{e.field}</TableCell>
                        <TableCell className="text-muted-foreground">{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleCommit}
                disabled={phase.step === "committing" || phase.report.valid.length === 0}
              >
                {phase.step === "committing" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <CheckCircle2Icon />
                )}
                {phase.step === "committing"
                  ? "Importing…"
                  : `Import ${phase.report.valid.length} members`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={phase.step === "committing"}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {phase.step === "done" ? (
          <div className="mt-3 flex flex-col items-start gap-3">
            <p className="text-sm">
              <CheckCircle2Icon className="mr-1 inline size-4 text-mdpva-accent dark:text-mdpva-gold" />
              Imported <span className="font-medium tabular-nums">{phase.inserted}</span>{" "}
              members successfully.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/members" />}>
                View members
              </Button>
              <Button variant="ghost" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
