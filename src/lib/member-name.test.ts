import { describe, expect, it } from "vitest";

import { fullName } from "./member-name";

describe("fullName", () => {
  it("returns the full name as stored", () => {
    expect(fullName("Kavya Bhat")).toBe("Kavya Bhat");
  });

  it("trims and collapses stray whitespace", () => {
    expect(fullName("  Kavya   Bhat ")).toBe("Kavya Bhat");
  });

  it.each([[null], [undefined], [""], ["   "]])(
    "returns an empty string for %p",
    (name) => {
      expect(fullName(name)).toBe("");
    },
  );
});
