import { describe, expect, it } from "vitest";

import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

describe("sanitizeCallbackUrl", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeCallbackUrl("/members")).toBe("/members");
    expect(sanitizeCallbackUrl("/members?tab=fees")).toBe(
      "/members?tab=fees",
    );
  });

  it("falls back to / for null/undefined/empty", () => {
    expect(sanitizeCallbackUrl(null)).toBe("/");
    expect(sanitizeCallbackUrl(undefined)).toBe("/");
    expect(sanitizeCallbackUrl("")).toBe("/");
  });

  it("rejects absolute URLs (open redirect)", () => {
    expect(sanitizeCallbackUrl("https://evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("http://evil.com/phish")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("//evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("//evil.com/path")).toBe("/");
  });

  it("rejects backslash-based bypasses (browsers normalize \\ to /)", () => {
    expect(sanitizeCallbackUrl("/\\evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("/\\/evil.com")).toBe("/");
  });

  it("rejects paths not starting with /", () => {
    expect(sanitizeCallbackUrl("evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("javascript:alert(1)")).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(sanitizeCallbackUrl("//evil.com", "/dashboard")).toBe(
      "/dashboard",
    );
  });
});
