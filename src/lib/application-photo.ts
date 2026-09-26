import { photoUrl } from "@/lib/photo-url";

/**
 * True for keys under the pending prefix. Pure, and kept out of `@/lib/r2`
 * so client components and tests can use it without constructing the S3
 * client; `@/lib/r2` re-exports it.
 */
export function isPendingPhotoKey(key: string): boolean {
  return key.startsWith("app/pending/");
}

export type ApplicationPhoto =
  | { kind: "photo"; src: string }
  | { kind: "discarded" }
  | { kind: "none" };

/**
 * Decides which image to show for an application in the review queue and on
 * its detail page.
 *
 * The pending photo (`app/pending/<id>.webp`) is deleted from R2 once an
 * application leaves `pending` — promoted to the live key on approve,
 * discarded on reject or supersede — so a reviewed row must never render it:
 *
 * - pending: the submitted photo itself.
 * - approved: the member's live photo (what the approval produced).
 * - rejected/superseded with a live key (an approved application reopened
 *   for resubmit): that live photo, versioned by the member's `updatedAt`.
 * - rejected/superseded with a pending key or none: "discarded" placeholder.
 */
export function applicationPhoto(
  app: { status: string; photoKey: string | null },
  member: { photoKey: string | null; updatedAt: Date },
): ApplicationPhoto {
  if (app.status === "pending") {
    const src = photoUrl(app.photoKey);
    return src ? { kind: "photo", src } : { kind: "none" };
  }
  if (app.status === "approved") {
    const src = photoUrl(member.photoKey, member.updatedAt);
    return src ? { kind: "photo", src } : { kind: "none" };
  }
  if (app.photoKey && !isPendingPhotoKey(app.photoKey)) {
    const src = photoUrl(app.photoKey, member.updatedAt);
    if (src) return { kind: "photo", src };
  }
  return { kind: "discarded" };
}
