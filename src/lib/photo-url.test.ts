import { describe, expect, it } from "vitest";

import { photoUrl } from "./photo-url";

describe("photoUrl", () => {
  it("returns null when there is no key", () => {
    expect(photoUrl(null)).toBeNull();
    expect(photoUrl(null, new Date())).toBeNull();
  });

  it("returns a plain URL when no version is given", () => {
    expect(photoUrl("app/pending/app-1.webp")).toBe(
      "/api/photos/app/pending/app-1.webp",
    );
  });

  it("produces a different URL when the version changes", () => {
    const before = photoUrl(
      "app/members/m-1.webp",
      new Date("2026-01-01T00:00:00Z"),
    );
    const after = photoUrl(
      "app/members/m-1.webp",
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(before).not.toBe(after);
  });

  it("produces the same URL for the same key and version", () => {
    const version = new Date("2026-01-01T00:00:00Z");
    expect(photoUrl("app/members/m-1.webp", version)).toBe(
      photoUrl("app/members/m-1.webp", version),
    );
  });

  it("accepts a raw timestamp or string as the version", () => {
    expect(photoUrl("app/members/m-1.webp", 123)).toBe(
      "/api/photos/app/members/m-1.webp?v=123",
    );
    expect(photoUrl("app/members/m-1.webp", "abc")).toBe(
      "/api/photos/app/members/m-1.webp?v=abc",
    );
  });
});
