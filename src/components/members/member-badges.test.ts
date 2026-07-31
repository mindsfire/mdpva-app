import { describe, expect, it } from "vitest";

import { initials } from "./member-badges";

describe("initials", () => {
  it("uses both initials when a surname is present", () => {
    expect(initials("Kavya", "Bhat")).toBe("KB");
  });

  // The dashboard and directory outage: last_name is nullable in the database
  // (many members have no separable surname), and `.charAt` on null throws
  // inside every avatar render.
  it.each([[null], [""], ["   "]])(
    "falls back to two letters of the given name when the surname is %p",
    (last) => {
      expect(initials("Shivakumar", last as string | null)).toBe("SH");
    },
  );

  it("does not throw on a single-character name with no surname", () => {
    expect(initials("A", null)).toBe("A");
  });

  it("upper-cases lowercase input", () => {
    expect(initials("asha", "rao")).toBe("AR");
  });
});
