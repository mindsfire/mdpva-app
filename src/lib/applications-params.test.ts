import { describe, expect, it } from "vitest";

import {
  applicationTabHref,
  parseApplicationTab,
  queueSkeletonShape,
} from "./applications-params";

describe("parseApplicationTab", () => {
  it("accepts the three tabs", () => {
    expect(parseApplicationTab("pending")).toBe("pending");
    expect(parseApplicationTab("approved")).toBe("approved");
    expect(parseApplicationTab("rejected")).toBe("rejected");
  });

  it("falls back to pending for anything else", () => {
    expect(parseApplicationTab(undefined)).toBe("pending");
    expect(parseApplicationTab("superseded")).toBe("pending");
    expect(parseApplicationTab("")).toBe("pending");
  });
});

describe("applicationTabHref", () => {
  it("links to just the tab when nothing else is set", () => {
    expect(applicationTabHref("approved", {})).toBe(
      "/applications?status=approved",
    );
  });

  it("keeps the search and a non-default page size", () => {
    expect(applicationTabHref("rejected", { q: "ravi", perPage: 200 })).toBe(
      "/applications?status=rejected&q=ravi&perPage=200",
    );
  });

  it("omits the default page size", () => {
    expect(applicationTabHref("pending", { perPage: 100 })).toBe(
      "/applications?status=pending",
    );
  });
});

describe("queueSkeletonShape", () => {
  const counts = { pending: 252, approved: 7, rejected: 0 };

  it("sizes a full page of the destination tab", () => {
    expect(queueSkeletonShape("/applications?status=pending", counts)).toEqual({
      rows: 100,
      selectable: true,
    });
  });

  it("uses the destination tab, not the current one", () => {
    expect(queueSkeletonShape("/applications?status=approved", counts)).toEqual({
      rows: 7,
      selectable: false,
    });
  });

  it("sizes the last, partial page", () => {
    expect(
      queueSkeletonShape("/applications?status=pending&page=3", counts),
    ).toEqual({ rows: 52, selectable: true });
  });

  it("follows a page-size change", () => {
    expect(
      queueSkeletonShape("/applications?status=pending&perPage=200", counts),
    ).toEqual({ rows: 200, selectable: true });
  });

  it("clamps a page past the end, like the query does", () => {
    expect(
      queueSkeletonShape("/applications?status=approved&page=9", counts),
    ).toEqual({ rows: 7, selectable: false });
  });

  it("draws at least one row for an empty tab", () => {
    expect(queueSkeletonShape("/applications?status=rejected", counts)).toEqual({
      rows: 1,
      selectable: false,
    });
  });
});
