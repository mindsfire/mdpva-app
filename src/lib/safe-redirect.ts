/**
 * Guards against open-redirect via a `callbackUrl` query param: only
 * accepts same-origin relative paths (`/foo`), rejecting absolute URLs
 * (`https://evil.com`) and protocol-relative URLs (`//evil.com`, which
 * browsers resolve against the current scheme).
 */
export function sanitizeCallbackUrl(
  callbackUrl: string | null | undefined,
  fallback = "/",
): string {
  if (!callbackUrl) return fallback;
  if (!callbackUrl.startsWith("/")) return fallback;
  if (callbackUrl.startsWith("//")) return fallback;
  return callbackUrl;
}
