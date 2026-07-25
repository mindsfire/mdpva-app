/**
 * Guards against open-redirect via a `callbackUrl` query param: only
 * accepts same-origin relative paths (`/foo`), rejecting absolute URLs
 * (`https://evil.com`) and protocol-relative URLs (`//evil.com`, which
 * browsers resolve against the current scheme).
 *
 * Browsers normalize a leading backslash to a forward slash when
 * navigating, so `/\evil.com` or `/\/evil.com` would otherwise slip past
 * the `startsWith("/")` check and the `startsWith("//")` check (neither
 * string literally starts with `//`) while still resolving off-origin.
 * Normalize backslashes to slashes before running the `//` check.
 */
export function sanitizeCallbackUrl(
  callbackUrl: string | null | undefined,
  fallback = "/",
): string {
  if (!callbackUrl) return fallback;
  if (!callbackUrl.startsWith("/")) return fallback;
  const backslashesNormalized = callbackUrl.replace(/\\/g, "/");
  if (backslashesNormalized.startsWith("//")) return fallback;
  return callbackUrl;
}
