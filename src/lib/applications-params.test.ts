import { describe, expect, it } from "vitest";

import {
  applicationTabHref,
  parseApplicationPerPage,
  parseApplicationTab,
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

describe("parseApplicationPerPage", () => {
  it("defaults to 100", () => {
    expect(parseApplicationPerPage(undefined)).toBe(100);
  });

  it("accepts 100, 200 and 500", () => {
    expect(parseApplicationPerPage("100")).toBe(100);
    expect(parseApplicationPerPage("200")).toBe(200);
    expect(parseApplicationPerPage("500")).toBe(500);
  });

  it("rejects values that aren't offered", () => {
    expect(parseApplicationPerPage("10")).toBe(100);
    expect(parseApplicationPerPage("100000")).toBe(100);
    expect(parseApplicationPerPage("abc")).toBe(100);
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
