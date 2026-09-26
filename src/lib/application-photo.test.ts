import { describe, expect, it } from "vitest";

import { applicationPhoto, isPendingPhotoKey } from "./application-photo";

const member = {
  photoKey: "app/members/m-1.webp",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};
const v = member.updatedAt.getTime();

describe("isPendingPhotoKey", () => {
  it("matches only the pending prefix", () => {
    expect(isPendingPhotoKey("app/pending/a.webp")).toBe(true);
    expect(isPendingPhotoKey("app/members/m.webp")).toBe(false);
  });
});

describe("applicationPhoto", () => {
  it("shows the submitted photo for a pending application", () => {
    expect(
      applicationPhoto({ status: "pending", photoKey: "app/pending/a.webp" }, member),
    ).toEqual({ kind: "photo", src: "/api/photos/app/pending/a.webp" });
  });

  it("shows none for a pending application without a photo", () => {
    expect(applicationPhoto({ status: "pending", photoKey: null }, member)).toEqual({
      kind: "none",
    });
  });

  it("shows the member's live photo for an approved application, never the deleted pending key", () => {
    expect(
      applicationPhoto({ status: "approved", photoKey: "app/pending/a.webp" }, member),
    ).toEqual({ kind: "photo", src: `/api/photos/app/members/m-1.webp?v=${v}` });
  });

  it("shows none for an approved application whose member has no photo", () => {
    expect(
      applicationPhoto(
        { status: "approved", photoKey: null },
        { ...member, photoKey: null },
      ),
    ).toEqual({ kind: "none" });
  });

  it("shows the discarded placeholder for rejected/superseded applications", () => {
    expect(applicationPhoto({ status: "rejected", photoKey: null }, member)).toEqual({
      kind: "discarded",
    });
    // Legacy rows still pointing at the deleted pending object.
    expect(
      applicationPhoto({ status: "rejected", photoKey: "app/pending/a.webp" }, member),
    ).toEqual({ kind: "discarded" });
    expect(
      applicationPhoto({ status: "superseded", photoKey: "app/pending/a.webp" }, member),
    ).toEqual({ kind: "discarded" });
  });

  it("keeps showing the live photo for an approved application reopened as rejected", () => {
    expect(
      applicationPhoto({ status: "rejected", photoKey: "app/members/m-1.webp" }, member),
    ).toEqual({ kind: "photo", src: `/api/photos/app/members/m-1.webp?v=${v}` });
  });
});
