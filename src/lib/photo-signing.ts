const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a signed link stays valid after its signing time. A day plus an
 * hour: the redirect to it is browser-cached until the end of the current
 * (UTC) day at most, and the signing time is never before the start of that
 * day, so a cached redirect always points at a link that still works.
 */
export const SIGNED_URL_TTL_SECONDS = 25 * 60 * 60;

export interface SigningWindow {
  /** The SigV4 signing time to presign with. */
  signingDate: Date;
  /** How long the browser may cache the redirect to the signed link. */
  redirectMaxAgeSeconds: number;
}

/**
 * Picks a *stable* signing time for a photo's signed R2 link.
 *
 * Signing with "now" would produce a new URL on every request, so the browser
 * could never reuse its cached image bytes. Instead every request in the same
 * UTC day signs at the start of that day and gets the identical URL.
 *
 * That alone would break photo replacement: a live member photo's key is
 * reused (see `photoKeyFor`), so the same-day URL would keep serving the old
 * cached face. `version` (the row's `updatedAt`, from the `?v=` param) fixes
 * that — a version later than the day start becomes the signing time, so a
 * photo changed today gets a URL no browser has cached.
 *
 * `version` comes from the query string, so it is untrusted: anything that
 * isn't a finite timestamp is ignored, and it's clamped to `now` because a
 * signing time in the future would produce a link R2 rejects. Tampering with
 * it only re-signs a link to an object the caller was already authorized for.
 */
export function signingWindow(
  version: string | null,
  now: number = Date.now(),
): SigningWindow {
  const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const v = version == null || version === "" ? NaN : Number(version);
  const versionMs = Number.isFinite(v) ? Math.min(v, now) : 0;
  const signedAt = Math.max(dayStart, versionMs);
  return {
    // SigV4 timestamps have second precision.
    signingDate: new Date(Math.floor(signedAt / 1000) * 1000),
    redirectMaxAgeSeconds: Math.floor((dayStart + DAY_MS - now) / 1000),
  };
}
