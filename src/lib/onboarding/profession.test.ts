import { describe, expect, it } from "vitest";

import { isoToDisplayableProfession } from "./profession";

describe("isoToDisplayableProfession", () => {
  it("passes through the current selectable options", () => {
    for (const value of ["photographer", "videographer", "photo_and_video", "other"]) {
      expect(isoToDisplayableProfession(value)).toBe(value);
    }
  });

  it("treats drone_operator as unset — removed from the public form", () => {
    expect(isoToDisplayableProfession("drone_operator")).toBe("");
  });

  it("treats null and unrecognised values as unset", () => {
    expect(isoToDisplayableProfession(null)).toBe("");
    expect(isoToDisplayableProfession("chef")).toBe("");
  });
});
