import Link from "next/link";
import { notFound } from "next/navigation";

import { getApplicationForReview } from "@/app/actions/applications";
import { ReviewActions } from "@/components/applications/review-actions";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { countChanges, diffApplication } from "@/lib/onboarding/diff";
import { photoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const KIND_STYLES: Record<string, string> = {
  added: "text-emerald-700 dark:text-emerald-400",
  changed: "text-mdpva-accent dark:text-mdpva-gold",
  kept: "text-muted-foreground italic",
  same: "text-muted-foreground",
};

export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getApplicationForReview(id);
  if (!data) notFound();

  const { application: app, member } = data;
  const diffs = diffApplication(member, app);
  const changes = countChanges(diffs);
  const isPending = app.status === "pending";

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Applications", href: "/applications" },
          { label: app.applicationNo },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            {app.applicationNo}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {dateFmt.format(app.createdAt)} · ledger no.{" "}
            {member.legacyId ?? "—"} · {member.memberId}
          </p>
        </div>
        {isPending ? (
          <ReviewActions applicationId={app.id} applicationNo={app.applicationNo} />
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-sm capitalize text-muted-foreground">
            {app.status}
            {app.reviewedAt ? ` · ${dateFmt.format(app.reviewedAt)}` : ""}
          </span>
        )}
      </div>

      {app.rejectionReason ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
          <b className="font-medium">Rejected:</b> {app.rejectionReason}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Photo is the main thing being reviewed, so it gets real size. */}
        <section className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Submitted photo
            </p>
            {app.photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element -- auth-gated stream from R2
              <img
                src={photoUrl(app.photoKey) ?? undefined}
                alt="Submitted photograph"
                className="w-full max-w-[240px] rounded-lg border border-mdpva-border object-cover dark:border-border"
                style={{ aspectRatio: "7 / 9" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No photo submitted.</p>
            )}
          </div>

          {member.photoKey ? (
            <div>
              <p className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Current photo
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated stream from R2 */}
              <img
                src={photoUrl(member.photoKey, member.updatedAt) ?? undefined}
                alt="Current photograph"
                className="w-full max-w-[140px] rounded-lg border border-mdpva-border object-cover opacity-80 dark:border-border"
                style={{ aspectRatio: "7 / 9" }}
              />
            </div>
          ) : null}
        </section>

        <section>
          <p className="mb-3 flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Changes
            <span className="text-xs font-normal tracking-normal normal-case">
              {changes === 0
                ? "nothing will change on the member record"
                : `${changes} field${changes === 1 ? "" : "s"} will be written`}
            </span>
          </p>

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
                {diffs.map((d) => (
                  <tr
                    key={d.field}
                    className={cn(
                      "border-b border-mdpva-border/60 last:border-0 dark:border-border/60",
                      (d.kind === "added" || d.kind === "changed") &&
                        "bg-mdpva-gold/[0.07]",
                    )}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{d.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {d.current ?? "—"}
                    </td>
                    <td className={cn("px-3 py-2 font-medium", KIND_STYLES[d.kind])}>
                      {d.kind === "kept" ? "left blank — current value kept" : (d.submitted ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            render={<Link href={`/members/${member.id}`} />}
          >
            View member record
          </Button>
        </section>
      </div>
    </div>
  );
}
