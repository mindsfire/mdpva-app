"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { correctPendingApplication } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOMINEE_RELATIONSHIPS } from "@/lib/nominee";
import type { DiffField, FieldDiff } from "@/lib/onboarding/diff";
import { cn } from "@/lib/utils";

/**
 * The application's submitted values for the fields an admin may correct —
 * exactly `CORRECTABLE_FIELDS` (src/lib/validation/application.ts), the list
 * the server enforces. A row gets an input only if its field is a key here.
 */
export type CorrectableValues = Partial<Record<DiffField, string | null>>;

const KIND_STYLES: Record<string, string> = {
  added: "text-emerald-700 dark:text-emerald-400",
  changed: "text-mdpva-accent dark:text-mdpva-gold",
  kept: "text-muted-foreground italic",
  cleared: "text-muted-foreground italic",
  same: "text-muted-foreground",
};

/**
 * Whether the admin has unsaved corrections open. Shared with `ReviewActions`
 * so Approve can't be clicked mid-edit — approving would silently write the
 * uncorrected values and drop what was typed.
 */
const EditingContext = React.createContext<{
  editing: boolean;
  setEditing: (editing: boolean) => void;
}>({ editing: false, setEditing: () => {} });

export function ReviewEditingProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = React.useState(false);
  const value = React.useMemo(() => ({ editing, setEditing }), [editing]);
  return <EditingContext.Provider value={value}>{children}</EditingContext.Provider>;
}

export function useReviewEditing() {
  return React.useContext(EditingContext).editing;
}

/**
 * The Current vs Submitted table. On a pending application the Submitted
 * column can be edited in place to fix spelling, spacing or capitalisation
 * before approving; saving overwrites the submitted values and the diff
 * re-renders from the server.
 */
export function ReviewChanges({
  applicationId,
  diffs,
  values,
  isPending,
  memberHref,
}: {
  applicationId: string;
  diffs: FieldDiff[];
  /** The application's raw submitted values for the correctable fields. */
  values: CorrectableValues;
  isPending: boolean;
  memberHref: string;
}) {
  const router = useRouter();
  const { editing, setEditing } = React.useContext(EditingContext);
  const [draft, setDraft] = React.useState<CorrectableValues>(values);
  const [error, setError] = React.useState<{ field?: string; message: string } | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);

  const changes = diffs.filter(
    (d) => d.kind === "added" || d.kind === "changed" || d.kind === "cleared",
  ).length;

  function startEditing() {
    setDraft(values);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      const result = await correctPendingApplication(applicationId, draft);
      if (!result.ok) {
        setError({ field: result.field, message: result.error ?? "Could not save." });
        return;
      }
      toast.success("Corrections saved.");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function setField(field: DiffField, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (error?.field === field) setError(null);
  }

  return (
    <>
      <p className="mb-3 flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Changes
        <span className="text-xs font-normal tracking-normal normal-case">
          {!isPending
            ? "compared with the member record as it is now"
            : changes === 0
              ? "nothing will change on the member record"
              : `${changes} field${changes === 1 ? "" : "s"} will be written`}
        </span>
      </p>

      {editing ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Fix spelling, spacing or capitals, then save. Phone, Aadhaar, date of
          birth, blood group and profession can&apos;t be edited here — reject
          the application if one of those is wrong.
        </p>
      ) : null}

      {error && !error.field ? (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-mdpva-border dark:border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mdpva-border text-left dark:border-border">
              <th className="px-3 py-2 font-medium text-muted-foreground">Field</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Current</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => {
              const editable = editing && d.field in values;
              const fieldError = error?.field === d.field ? error.message : null;
              return (
                <tr
                  key={d.field}
                  className={cn(
                    "border-b border-mdpva-border/60 last:border-0 dark:border-border/60",
                    !editing &&
                      (d.kind === "added" || d.kind === "changed" || d.kind === "cleared") &&
                      "bg-mdpva-gold/[0.07]",
                  )}
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    <label htmlFor={editable ? `correct-${d.field}` : undefined}>
                      {d.label}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.current ?? "—"}</td>
                  <td className={cn("px-3 py-2 font-medium", !editable && KIND_STYLES[d.kind])}>
                    {editable ? (
                      <>
                        <CorrectionInput
                          field={d.field}
                          value={draft[d.field] ?? ""}
                          invalid={fieldError !== null}
                          onChange={(v) => setField(d.field, v)}
                        />
                        {fieldError ? (
                          <p className="mt-1 text-xs font-normal text-destructive">
                            {fieldError}
                          </p>
                        ) : null}
                      </>
                    ) : d.kind === "kept" ? (
                      "left blank — current value kept"
                    ) : d.kind === "cleared" ? (
                      "will be removed — Address above is the full address"
                    ) : (
                      (d.submitted ?? "—")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save corrections"}
            </Button>
            <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </>
        ) : isPending ? (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <PencilIcon />
            Edit
          </Button>
        ) : null}
        <Button variant="outline" size="sm" render={<Link href={memberHref} />}>
          View member record
        </Button>
      </div>
    </>
  );
}

function CorrectionInput({
  field,
  value,
  invalid,
  onChange,
}: {
  field: DiffField;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  if (field === "nomineeRelationship") {
    return (
      <Select value={value || undefined} onValueChange={(v) => onChange(String(v ?? ""))}>
        <SelectTrigger id={`correct-${field}`} className="w-full" aria-invalid={invalid}>
          <SelectValue placeholder="Select relationship" />
        </SelectTrigger>
        <SelectContent>
          {NOMINEE_RELATIONSHIPS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={`correct-${field}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      inputMode={field === "pincode" ? "numeric" : undefined}
      type={field === "email" ? "email" : "text"}
    />
  );
}
