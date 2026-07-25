import { and, asc, desc, eq, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";

export const MEMBERS_PAGE_SIZE = 50;

export type MemberStatusFilter = "active" | "inactive" | "suspended";
export type ProfessionFilter = "photographer" | "videographer" | "both";

/**
 * `name` (last_name asc, default) / `name_desc` (last_name desc) / `newest`
 * (created_at desc). Each has its own keyset tuple — see `SORT_CONFIG`.
 */
export type MembersSort = "name" | "name_desc" | "newest";

export interface MembersQueryParams {
  q?: string;
  status?: MemberStatusFilter;
  profession?: ProfessionFilter;
  feesDue?: boolean;
  deathFund?: boolean;
  sort?: MembersSort;
  cursor?: string;
}

export interface MemberRow {
  id: string;
  memberId: string;
  legacyId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  profession: "photographer" | "videographer" | "both" | null;
  status: "active" | "inactive" | "suspended";
  feesPaidUpto: number | null;
  deathFundCovered: boolean;
  photoKey: string | null;
}

export interface MembersSearchResult {
  rows: MemberRow[];
  nextCursor: string | null;
}

export interface MemberDetail {
  id: string;
  memberId: string;
  legacyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  profession: "photographer" | "videographer" | "both" | null;
  businessName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  city: string;
  state: string;
  pincode: string | null;
  dob: string | null;
  bloodGroup: string | null;
  status: "active" | "inactive" | "suspended";
  feesPaidUpto: number | null;
  deathFundCovered: boolean;
  photoKey: string | null;
  notes: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Full profile record for the member sheet/page. Excludes soft-deleted
 * members. Ids come from user-editable URLs (`?member=…`, `/members/[id]`),
 * so a non-uuid is a normal "not found" — without this guard Postgres
 * raises a type error and takes the whole page to the error boundary.
 */
export async function getMemberById(id: string): Promise<MemberDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    memberId: row.memberId,
    legacyId: row.legacyId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    profession: row.profession,
    businessName: row.businessName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    area: row.area,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    dob: row.dob,
    bloodGroup: row.bloodGroup,
    status: row.status,
    feesPaidUpto: row.feesPaidUpto,
    deathFundCovered: row.deathFundCovered,
    photoKey: row.photoKey,
    notes: row.notes,
  };
}

const DEFAULT_SORT: MembersSort = "name";

/**
 * Per-sort keyset config: the sort column + comparison direction, plus
 * `id` as the tiebreaker (same direction as the sort column, so the
 * combined `(sortColumn, id)` tuple is strictly monotonic either way).
 */
const SORT_CONFIG = {
  name: { column: members.lastName, direction: "asc" as const },
  name_desc: { column: members.lastName, direction: "desc" as const },
  newest: { column: members.createdAt, direction: "desc" as const },
} satisfies Record<
  MembersSort,
  { column: typeof members.lastName | typeof members.createdAt; direction: "asc" | "desc" }
>;

interface KeysetCursor {
  sort: MembersSort;
  /** String form of the sort column's value (ISO string for timestamps). */
  key: string;
  id: string;
}

/** Parses the opaque cursor string; returns null instead of throwing on bad input. */
function parseCursor(cursor: string | undefined): KeysetCursor | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const sort = record.sort;
    if (
      typeof sort === "string" &&
      Object.prototype.hasOwnProperty.call(SORT_CONFIG, sort) &&
      typeof record.key === "string" &&
      typeof record.id === "string"
    ) {
      return { sort: sort as MembersSort, key: record.key, id: record.id };
    }
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(row: KeysetCursor): string {
  return JSON.stringify(row);
}

/**
 * Pure builder: maps validated query params to a single drizzle `SQL`
 * condition (soft-delete exclusion is always included). Extracted from
 * `searchMembers` so the query-param → SQL-filter mapping is unit testable
 * without a live db connection.
 */
export function buildMembersWhere(params: MembersQueryParams): SQL {
  const conditions: SQL[] = [isNull(members.deletedAt)];

  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(
      or(
        ilike(members.firstName, term),
        ilike(members.lastName, term),
        ilike(members.phone, term),
        ilike(members.memberId, term),
        ilike(members.legacyId, term),
      )!,
    );
  }

  if (params.status) {
    conditions.push(sql`${members.status} = ${params.status}`);
  }

  if (params.profession) {
    conditions.push(sql`${members.profession} = ${params.profession}`);
  }

  if (params.feesDue) {
    const currentYear = new Date().getFullYear();
    conditions.push(
      or(
        isNull(members.feesPaidUpto),
        lt(members.feesPaidUpto, currentYear),
      )!,
    );
  }

  if (params.deathFund) {
    conditions.push(sql`${members.deathFundCovered} = true`);
  }

  const activeSort = params.sort ?? DEFAULT_SORT;
  const cursor = parseCursor(params.cursor);
  if (cursor && cursor.sort === activeSort) {
    const { column, direction } = SORT_CONFIG[activeSort];
    const op = direction === "asc" ? sql`>` : sql`<`;
    conditions.push(
      or(
        sql`${column} ${op} ${cursor.key}`,
        and(sql`${column} = ${cursor.key}`, sql`${members.id} ${op} ${cursor.id}`)!,
      )!,
    );
  }

  return and(...conditions)!;
}

/**
 * Server-side keyset pagination on `(last_name, id)`, 50/page. Never loads
 * the full members list — always bounded by `MEMBERS_PAGE_SIZE`.
 */
export async function searchMembers(
  params: MembersQueryParams,
): Promise<MembersSearchResult> {
  const where = buildMembersWhere(params);
  const activeSort = params.sort ?? DEFAULT_SORT;
  const { column, direction } = SORT_CONFIG[activeSort];
  const orderFn = direction === "asc" ? asc : desc;

  const rows = await db
    .select({
      id: members.id,
      memberId: members.memberId,
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
      profession: members.profession,
      status: members.status,
      feesPaidUpto: members.feesPaidUpto,
      deathFundCovered: members.deathFundCovered,
      photoKey: members.photoKey,
      createdAt: members.createdAt,
    })
    .from(members)
    .where(where)
    .orderBy(orderFn(column), orderFn(members.id))
    .limit(MEMBERS_PAGE_SIZE + 1);

  const hasMore = rows.length > MEMBERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MEMBERS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    rows: page.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- createdAt is query-internal, not part of the public MemberRow shape
      const { createdAt, ...rest } = row;
      return rest;
    }),
    nextCursor:
      hasMore && last
        ? encodeCursor({
            sort: activeSort,
            key:
              activeSort === "newest"
                ? last.createdAt.toISOString()
                : last.lastName,
            id: last.id,
          })
        : null,
  };
}
