import { describe, expect, it } from "vitest";

import { fullName } from "./member-name";

describe("fullName", () => {
  it("joins both parts with a single space", () => {
    expect(fullName("Kavya", "Bhat")).toBe("Kavya Bhat");
  });

  // The reason this helper exists: `${first} ${last}` leaves a dangling space
  // for the third of the membership that has no surname.
  it.each([[null], [undefined], [""], ["   "]])(
    "returns just the given name when the surname is %p",
    (last) => {
      expect(fullName("Shivakumar", last)).toBe("Shivakumar");
    },
  );

  it("trims stray whitespace around either part", () => {
    expect(fullName("  Kavya ", " Bhat ")).toBe("Kavya Bhat");
  });

  it("returns an empty string when nothing is set", () => {
    expect(fullName(null, null)).toBe("");
  });
});
