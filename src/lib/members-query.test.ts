import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  buildMembersWhere,
  isUuid,
  type MembersQueryParams,
} from "./members-query";

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

  it("adds an ILIKE clause across name/phone/member_id/legacy_id for q", () => {
    const sql = render({ q: "sha" });
    expect(sql).toContain("ilike");
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

  it("adds a keyset cursor condition on (last_name, id) for the default (name) sort", () => {
    const withCursor = render({
      cursor: JSON.stringify({ sort: "name", key: "Rao", id: "abc-123" }),
    });
    const withoutCursor = render({});
    expect(withCursor.length).toBeGreaterThan(withoutCursor.length);
    expect(withCursor).toContain("last_name");
    expect(withCursor).toContain(">");
  });

  it("flips the cursor comparison to `<` for name_desc", () => {
    const sql = render({
      sort: "name_desc",
      cursor: JSON.stringify({ sort: "name_desc", key: "Rao", id: "abc-123" }),
    });
    expect(sql).toContain("last_name");
    expect(sql).toContain("<");
  });

  it("keysets on created_at for the newest sort", () => {
    const sql = render({
      sort: "newest",
      cursor: JSON.stringify({
        sort: "newest",
        key: "2026-01-01T00:00:00.000Z",
        id: "abc-123",
      }),
    });
    expect(sql).toContain("created_at");
    expect(sql).toContain("<");
  });

  it("ignores a cursor minted for a different sort (stale cursor after switching sort)", () => {
    const withStaleCursor = render({
      sort: "newest",
      cursor: JSON.stringify({ sort: "name", key: "Rao", id: "abc-123" }),
    });
    const withoutCursor = render({ sort: "newest" });
    expect(withStaleCursor).toBe(withoutCursor);
  });

  it("ignores an unparsable cursor rather than throwing", () => {
    expect(() => buildMembersWhere({ cursor: "not-json" })).not.toThrow();
  });

  it("ignores a cursor with an unknown sort value rather than throwing", () => {
    expect(() =>
      buildMembersWhere({
        cursor: JSON.stringify({ sort: "bogus", key: "x", id: "y" }),
      }),
    ).not.toThrow();
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
