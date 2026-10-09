/**
 * Builds the URL for a photo served by `/api/photos/[...key]`.
 *
 * Live member photos live at a fixed, intentionally-reused R2 key
 * (`photoKeyFor` in `@/lib/r2`), so the URL never changes on its own when the
 * bytes behind it do. Pass the row's `updatedAt` as `version` for any such
 * key so a real photo change produces a new URL — the same reasoning as a
 * content-hashed asset filename, needed because the serving route's redirect
 * is cached in the browser. The route also folds `version` into the signed R2
 * link it redirects to, so the image bytes are re-fetched too.
 *
 * Per-submission keys (pending application photos) are never reused, so they
 * can omit `version`.
 *
 * `thumb` asks for the small rendition (see `makeThumbnail`) — for avatars
 * and list rows, which display the photo at a few dozen pixels. The route
 * falls back to the full photo when no thumbnail has been made yet.
 */
export function photoUrl(
  key: string | null,
  version?: Date | number | string | null,
  { thumb = false }: { thumb?: boolean } = {},
): string | null {
  if (!key) return null;
  const params = new URLSearchParams();
  if (version != null) {
    params.set("v", String(version instanceof Date ? version.getTime() : version));
  }
  if (thumb) params.set("size", "thumb");
  const query = params.toString();
  return query ? `/api/photos/${key}?${query}` : `/api/photos/${key}`;
}
