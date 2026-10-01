import { describe, expect, it } from "vitest";

import {
  applicationTabHref,
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
