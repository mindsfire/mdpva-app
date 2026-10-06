import { notFound } from "next/navigation";
import { DownloadIcon, PencilIcon } from "lucide-react";

import { getApplicationForReview } from "@/app/actions/applications";
import { ReopenForResubmitAction } from "@/components/applications/reopen-action";
import { ReviewActions } from "@/components/applications/review-actions";
import {
  ReviewChanges,
  ReviewEditingProvider,
  type CorrectableValues,
} from "@/components/applications/review-changes";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { diffApplication } from "@/lib/onboarding/diff";
import { applicationPhoto } from "@/lib/application-photo";
import { formatDateTimeIST } from "@/lib/format-date";
import { photoUrl } from "@/lib/photo-url";
import { CORRECTABLE_FIELDS } from "@/lib/validation/application";
import { PhotoImg } from "@/components/photo-img";

export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getApplicationForReview(id);
  if (!data) notFound();

  const { application: app, member, editedByName } = data;
  const diffs = diffApplication(member, app);
  const isPending = app.status === "pending";
  const submittedPhoto = applicationPhoto(app, member);
  const correctable: CorrectableValues = Object.fromEntries(
    CORRECTABLE_FIELDS.map((field) => [field, app[field]]),
  );

  return (
    <ReviewEditingProvider>
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
              Submitted {formatDateTimeIST(app.createdAt)} · ledger no.{" "}
              {member.legacyId ?? "—"} · {member.memberId}
            </p>
            {app.editedAt ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-mdpva-accent dark:text-mdpva-gold">
                <PencilIcon className="size-3.5" aria-hidden />
                Corrected by {editedByName ?? "an admin"} ·{" "}
                {formatDateTimeIST(app.editedAt)}
              </p>
            ) : null}
          </div>
          {isPending ? (
            <ReviewActions applicationId={app.id} applicationNo={app.applicationNo} />
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-sm capitalize text-muted-foreground">
                {app.status}
                {app.reviewedAt ? ` · ${formatDateTimeIST(app.reviewedAt)}` : ""}
              </span>
              {app.status === "approved" ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/api/applications/${app.id}/pdf`} />}
                >
                  <DownloadIcon />
                  Download application
                </Button>
              ) : null}
              {app.status === "approved" || app.status === "rejected" ? (
                <ReopenForResubmitAction
                  applicationId={app.id}
                  applicationNo={app.applicationNo}
                />
              ) : null}
            </div>
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
              {submittedPhoto.kind === "photo" ? (
                <PhotoImg
                  src={submittedPhoto.src}
                  alt="Submitted photograph"
                  className="w-full max-w-[240px] rounded-lg border border-mdpva-border object-cover dark:border-border"
                  style={{ aspectRatio: "7 / 9" }}
                  fallback={
                    <div
                      className="flex w-full max-w-[240px] items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
                      style={{ aspectRatio: "7 / 9" }}
                    >
                      Photo file is missing — ask the member to upload it again.
                    </div>
                  }
                />
              ) : submittedPhoto.kind === "unavailable" ? (
                <div
                  className="flex w-full max-w-[240px] items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
                  style={{ aspectRatio: "7 / 9" }}
                >
                  Photo no longer available — removed when this application was rejected.
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photo submitted.</p>
              )}
            </div>

            {member.photoKey ? (
              <div>
                <p className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Current photo
                </p>
                <PhotoImg
                  src={photoUrl(member.photoKey, member.updatedAt) ?? undefined}
                  alt="Current photograph"
                  className="w-full max-w-[140px] rounded-lg border border-mdpva-border object-cover opacity-80 dark:border-border"
                  style={{ aspectRatio: "7 / 9" }}
                  fallback={
                    <div
                      className="flex w-full max-w-[140px] items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
                      style={{ aspectRatio: "7 / 9" }}
                    >
                      Photo file is missing.
                    </div>
                  }
                />
              </div>
            ) : null}
          </section>

          <section>
            <ReviewChanges
              applicationId={app.id}
              diffs={diffs}
              values={correctable}
              isPending={isPending}
              memberHref={`/members/${member.id}`}
            />
          </section>
        </div>
      </div>
    </ReviewEditingProvider>
  );
}
