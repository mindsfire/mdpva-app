import { describe, expect, it } from "vitest";

import { MEMBERS_SORTS, parseSort } from "@/lib/members-params";

describe("parseSort", () => {
  it("accepts every supported sort", () => {
    for (const sort of MEMBERS_SORTS) {
      expect(parseSort(sort)).toBe(sort);
    }
  });

  it("includes both membership directions", () => {
    expect(parseSort("membership")).toBe("membership");
    expect(parseSort("membership_desc")).toBe("membership_desc");
  });

  // `?sort=` is user-editable, and an unrecognised value must fall through to
  // the default rather than reaching SORT_CONFIG, where an unknown key would
  // read as undefined and take the whole query with it.
  it("rejects anything else", () => {
    expect(parseSort("legacyId")).toBeUndefined();
    expect(parseSort("name; drop table members")).toBeUndefined();
    expect(parseSort("")).toBeUndefined();
    expect(parseSort(undefined)).toBeUndefined();
  });
});
