import { and, asc, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";

export const MEMBERS_PAGE_SIZE = 50;

export type MemberStatusFilter = "active" | "inactive" | "suspended";
export type ProfessionFilter = "photographer" | "videographer" | "both";

export interface MembersQueryParams {
  q?: string;
  status?: MemberStatusFilter;
  profession?: ProfessionFilter;
  feesDue?: boolean;
  deathFund?: boolean;
  sort?: "name" | "fees" | "status";
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

interface KeysetCursor {
  lastName: string;
  id: string;
}

/** Parses the opaque cursor string; returns null instead of throwing on bad input. */
function parseCursor(cursor: string | undefined): KeysetCursor | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).lastName === "string" &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as KeysetCursor;
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

  const cursor = parseCursor(params.cursor);
  if (cursor) {
    conditions.push(
      or(
        sql`${members.lastName} > ${cursor.lastName}`,
        and(
          sql`${members.lastName} = ${cursor.lastName}`,
          sql`${members.id} > ${cursor.id}`,
        )!,
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
    })
    .from(members)
    .where(where)
    .orderBy(asc(members.lastName), asc(members.id))
    .limit(MEMBERS_PAGE_SIZE + 1);

  const hasMore = rows.length > MEMBERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MEMBERS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    rows: page,
    nextCursor:
      hasMore && last
        ? encodeCursor({ lastName: last.lastName, id: last.id })
        : null,
  };
}
