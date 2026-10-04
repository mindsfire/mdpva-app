import { describe, expect, it } from "vitest";

import { stripQuery } from "./analytics";

describe("stripQuery", () => {
  it("drops the search query so typed names and phone numbers never leave the browser", () => {
    expect(
      stripQuery({ type: "pageview", url: "https://app.example.com/members?q=9845022345&page=2" }),
    ).toEqual({ type: "pageview", url: "https://app.example.com/members" });
  });

  it("leaves a URL without a query string unchanged", () => {
    const url = "https://app.example.com/applications/33333333-3333-3333-3333-333333333333";
    expect(stripQuery({ type: "pageview", url })).toEqual({ type: "pageview", url });
  });
});
