/**
 * Builds the URL for a photo served by `/api/photos/[...key]`.
 *
 * Live member photos live at a fixed, intentionally-reused R2 key
 * (`photoKeyFor` in `@/lib/r2`), so the URL never changes on its own when the
 * bytes behind it do. Pass the row's `updatedAt` as `version` for any such
 * key so a real photo change produces a new URL — the same reasoning as a
 * content-hashed asset filename, needed because the serving route caches the
 * response in the browser (`Cache-Control: private, max-age=3600`).
 *
 * Per-submission keys (pending application photos) are never reused, so they
 * can omit `version`.
 */
export function photoUrl(
  key: string | null,
  version?: Date | number | string | null,
): string | null {
  if (!key) return null;
  if (version == null) return `/api/photos/${key}`;
  const v = version instanceof Date ? version.getTime() : version;
  return `/api/photos/${key}?v=${v}`;
}
