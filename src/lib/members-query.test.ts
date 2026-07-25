import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  buildMembersWhere,
  isUuid,
  type MembersQueryParams,
} from "./members-query";
import { parsePage, parsePerPage } from "./members-params";

/**
 * `buildMembersWhere` returns a drizzle `SQL` condition tree. We compile it
 * to its parameterized query text via `PgDialect` (no live connection
 * needed) so this stays a pure, db-free unit test of the query-param → SQL
 * mapping.
 */
const dialect = new PgDialect();

function render(params: MembersQueryParams): string {
  const condition = buildMembersWhere(params);
  return dialect.sqlToQuery(condition).sql;
}

describe("buildMembersWhere", () => {
  it("always excludes soft-deleted members", () => {
    const sql = render({});
    expect(sql).toContain("deleted_at");
  });

  it("searches across every user-facing field, not just the name", () => {
    const sql = render({ q: "sha" });
    for (const column of [
      "first_name",
      "last_name",
      "email",
      "phone",
      "member_id",
      "legacy_id",
      "business_name",
      "address_line1",
      "area",
      "city",
      "state",
      "pincode",
      "blood_group",
      "profession",
      "status",
      "fees_paid_upto",
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("matches the full name so a first+last query finds the member", () => {
    const sql = render({ q: "Kavya Bhat" });
    expect(sql).toContain("|| ' ' ||");
  });

  it("maps the displayed 'Photo & Video' label onto the 'both' enum", () => {
    const sql = render({ q: "photo & video" });
    expect(sql).toContain("'both'");
  });

  it("treats 'due' as a fees-due search", () => {
    const sql = render({ q: "due" });
    expect(sql).toContain("fees_paid_upto");
  });

  it("ignores a whitespace-only query instead of matching everything", () => {
    expect(render({ q: "   " })).toBe(render({}));
  });

  it("filters by status when provided", () => {
    const sql = render({ status: "active" });
    expect(sql).toContain("status");
  });

  it("filters by profession when provided", () => {
    const sql = render({ profession: "photographer" });
    expect(sql).toContain("profession");
  });

  it("filters fees due (feesPaidUpto < current year or null) when feesDue is true", () => {
    const sql = render({ feesDue: true });
    expect(sql).toContain("fees_paid_upto");
  });

  it("filters death fund covered when deathFund is true", () => {
    const sql = render({ deathFund: true });
    expect(sql).toContain("death_fund_covered");
  });

  it("combines multiple filters together", () => {
    const sql = render({
      q: "sha",
      status: "active",
      profession: "both",
      feesDue: true,
      deathFund: true,
    });
    expect(sql).toContain("ilike");
    expect(sql).toContain("status");
    expect(sql).toContain("profession");
    expect(sql).toContain("fees_paid_upto");
    expect(sql).toContain("death_fund_covered");
  });
});

describe("isUuid", () => {
  it("accepts a real uuid in either case", () => {
    expect(isUuid("0edc565e-152e-4468-9a2b-a8c0f3b40a9b")).toBe(true);
    expect(isUuid("0EDC565E-152E-4468-9A2B-A8C0F3B40A9B")).toBe(true);
  });

  it("rejects the URL values that used to crash the directory", () => {
    // `?member=new` was a real 500: Postgres rejects it as a uuid.
    expect(isUuid("new")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("1234")).toBe(false);
    expect(isUuid("0edc565e-152e-4468-9a2b-a8c0f3b40a9")).toBe(false);
    expect(isUuid("0edc565e152e44689a2ba8c0f3b40a9b")).toBe(false);
    expect(isUuid("zzzzzzzz-152e-4468-9a2b-a8c0f3b40a9b")).toBe(false);
  });
});

describe("parsePerPage", () => {
  it("accepts the offered options", () => {
    expect(parsePerPage("10")).toBe(10);
    expect(parsePerPage("25")).toBe(25);
    expect(parsePerPage("100")).toBe(100);
  });

  it("falls back to 10 for anything else", () => {
    expect(parsePerPage(undefined)).toBe(10);
    expect(parsePerPage("")).toBe(10);
    expect(parsePerPage("50")).toBe(10);
    expect(parsePerPage("99999")).toBe(10);
    expect(parsePerPage("abc")).toBe(10);
    expect(parsePerPage("-25")).toBe(10);
  });
});

describe("parsePage", () => {
  it("accepts positive integers", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("7")).toBe(7);
  });

  it("falls back to page 1 for junk or out-of-range values", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});
