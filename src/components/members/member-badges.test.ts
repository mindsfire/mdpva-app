import { describe, expect, it } from "vitest";

import { initials } from "./member-badges";

describe("initials", () => {
  it("uses the first and last words of the full name", () => {
    expect(initials("Kavya Bhat")).toBe("KB");
    expect(initials("P. V. Anilkumar")).toBe("PA");
  });

  it("falls back to two letters of a single-word name", () => {
    expect(initials("Shivakumar")).toBe("SH");
    expect(initials("  Shivakumar  ")).toBe("SH");
  });

  it.each([[null], [undefined], [""], ["   "]])(
    "does not throw on an empty name (%p)",
    (name) => {
      expect(initials(name)).toBe("");
    },
  );

  it("does not throw on a single-character name", () => {
    expect(initials("A")).toBe("A");
  });

  it("upper-cases lowercase input", () => {
    expect(initials("asha rao")).toBe("AR");
  });
});
