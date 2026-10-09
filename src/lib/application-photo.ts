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
  | { kind: "unavailable" }
  | { kind: "none" };

/**
 * Decides which image to show for an application in the review queue and on
 * its detail page.
 *
 * - pending: the submitted photo itself.
 * - approved: the member's live photo (what the approval produced).
 * - rejected/superseded: the photo that was submitted with it, so admins can
 *   see what was rejected. Submitted photos are kept for this; an approved
 *   application reopened for resubmit carries the live key instead, shown
 *   versioned by the member's `updatedAt`.
 * - rejected/superseded with no key: "unavailable" — photos of applications
 *   rejected before submitted photos were kept were deleted at the time.
 *
 * `thumb` requests the small rendition, for the queue's list rows.
 */
export function applicationPhoto(
  app: { status: string; photoKey: string | null },
  member: { photoKey: string | null; updatedAt: Date },
  options: { thumb?: boolean } = {},
): ApplicationPhoto {
  if (app.status === "pending") {
    const src = photoUrl(app.photoKey, null, options);
    return src ? { kind: "photo", src } : { kind: "none" };
  }
  if (app.status === "approved") {
    const src = photoUrl(member.photoKey, member.updatedAt, options);
    return src ? { kind: "photo", src } : { kind: "none" };
  }
  if (app.photoKey) {
    const src = isPendingPhotoKey(app.photoKey)
      ? photoUrl(app.photoKey, null, options)
      : photoUrl(app.photoKey, member.updatedAt, options);
    if (src) return { kind: "photo", src };
  }
  return { kind: "unavailable" };
}
