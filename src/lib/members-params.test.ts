import { describe, expect, it } from "vitest";

import {
  DEFAULT_SORT,
  MEMBERS_SORTS,
  parseSort,
  rowsOnPage,
} from "@/lib/members-params";

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

describe("DEFAULT_SORT", () => {
  // The office works through the directory by membership number, so an
  // unsorted visit to /members must open on No. 1, not on names.
  it("is membership number, ascending", () => {
    expect(DEFAULT_SORT).toBe("membership");
  });
});

describe("rowsOnPage", () => {
  it("is a full page when there are enough rows", () => {
    expect(rowsOnPage("/members", 650)).toBe(100);
    expect(rowsOnPage("/members?perPage=500", 650)).toBe(500);
  });

  it("is the remainder on the last page", () => {
    expect(rowsOnPage("/members?page=7", 650)).toBe(50);
    expect(rowsOnPage("/members?page=2&perPage=500", 650)).toBe(150);
  });

  it("clamps a page past the end to the last page", () => {
    expect(rowsOnPage("/members?page=99", 650)).toBe(50);
  });

  it("is at least one row", () => {
    expect(rowsOnPage("/members", 0)).toBe(1);
  });
});
