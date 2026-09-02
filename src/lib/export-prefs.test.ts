import { describe, expect, it } from "vitest";

import { ALL_EXPORT_FIELDS } from "@/lib/csv/member-csv";
import { parseExportFieldsCookie } from "./export-prefs";

describe("parseExportFieldsCookie", () => {
  it("returns undefined for a missing cookie (falls back to all)", () => {
    expect(parseExportFieldsCookie(undefined)).toBeUndefined();
    expect(parseExportFieldsCookie("")).toBeUndefined();
  });

  it("keeps valid keys", () => {
    expect(parseExportFieldsCookie("phone,first_name")).toEqual([
      "first_name",
      "phone",
    ]);
  });

  it("drops unknown keys and keeps the rest", () => {
    expect(parseExportFieldsCookie("phone,surname,first_name")).toEqual([
      "first_name",
      "phone",
    ]);
  });

  it("returns undefined when nothing valid survives", () => {
    expect(parseExportFieldsCookie("surname,foo,bar")).toBeUndefined();
  });

  it("returns keys in canonical order regardless of cookie order", () => {
    // legacy_id (the recognised membership number) leads the canonical
    // order; notes trails it.
    expect(parseExportFieldsCookie("notes,legacy_id,phone")).toEqual([
      "legacy_id",
      "phone",
      "notes",
    ]);
  });

  it("dedupes repeated keys", () => {
    expect(parseExportFieldsCookie("phone,phone,first_name")).toEqual([
      "first_name",
      "phone",
    ]);
  });

  it("round-trips the full selection", () => {
    expect(parseExportFieldsCookie(ALL_EXPORT_FIELDS.join(","))).toEqual(
      ALL_EXPORT_FIELDS,
    );
  });
});
