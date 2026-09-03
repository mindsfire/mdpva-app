import { and, asc, desc, eq, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { members, users } from "@/db/schema";
import {
  DEFAULT_PER_PAGE,
  type MembersSort,
  type MemberStatusFilter,
  type PerPage,
  type ProfessionFilter,
} from "@/lib/members-params";

export * from "@/lib/members-params";

export interface MembersQueryParams {
  q?: string;
  status?: MemberStatusFilter;
  profession?: ProfessionFilter;
  feesDue?: boolean;
  deathFund?: boolean;
  sort?: MembersSort;
  page?: number;
  perPage?: PerPage;
}

export interface MemberRow {
  id: string;
  memberId: string;
  legacyId: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  profession:
    | "photographer"
    | "videographer"
    | "photo_and_video"
    | "drone_operator"
    | null;
  status: "active" | "inactive" | "suspended";
  feesPaidUpto: number | null;
  deathFundCovered: boolean;
  photoKey: string | null;
  updatedAt: Date;
}

export interface MembersSearchResult {
  rows: MemberRow[];
  total: number;
  page: number;
  perPage: PerPage;
  totalPages: number;
}

export interface MemberDetail {
  id: string;
  memberId: string;
  legacyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  profession:
    | "photographer"
    | "videographer"
    | "photo_and_video"
    | "drone_operator"
    | null;
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
  createdAt: Date;
  updatedAt: Date;
  /**
   * Display name of the admin who last changed this record, or null when no
   * person has — every ledger-imported member has `updated_by` null because a
   * script wrote them. A dash in the UI is therefore meaningful: it marks a
   * record untouched since the import.
   */
  updatedByName: string | null;
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
    .select({
      member: members,
      updatedByName: users.name,
    })
    .from(members)
    // Left join: `updated_by` is null for every imported member, and an inner
    // join would silently return "not found" for all 1307 of them.
    .leftJoin(users, eq(members.updatedBy, users.id))
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);

  if (!row) return null;

  const { member, updatedByName } = row;

  return {
    id: member.id,
    memberId: member.memberId,
    legacyId: member.legacyId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    profession: member.profession,
    businessName: member.businessName,
    addressLine1: member.addressLine1,
    addressLine2: member.addressLine2,
    area: member.area,
    city: member.city,
    state: member.state,
    pincode: member.pincode,
    dob: member.dob,
    bloodGroup: member.bloodGroup,
    status: member.status,
    feesPaidUpto: member.feesPaidUpto,
    deathFundCovered: member.deathFundCovered,
    photoKey: member.photoKey,
    notes: member.notes,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    updatedByName,
  };
}

const DEFAULT_SORT: MembersSort = "name";

/**
 * Name sorting uses the whole displayed name, not `last_name` alone: that
 * column is null for every member without a separable surname, which would
 * otherwise sort a third of the directory into one block at the end.
 */
const NAME_SORT_KEY = sql`lower(trim(${members.firstName} || ' ' || coalesce(${members.lastName}, '')))`;

/**
 * Membership numbers are stored as text but read as numbers, so sorting the
 * column directly would put 10 before 2. Digits are extracted and cast, and
 * anything with no digits at all (or no number yet) sorts last in *both*
 * directions — an empty value leading the list is never what you asked for.
 */
export const MEMBERSHIP_SORT_KEY = sql`nullif(regexp_replace(coalesce(${members.legacyId}, ''), '[^0-9]', '', 'g'), '')::bigint`;

const SORT_CONFIG = {
  name: { column: NAME_SORT_KEY, direction: "asc" as const },
  name_desc: { column: NAME_SORT_KEY, direction: "desc" as const },
  membership: {
    column: sql`${MEMBERSHIP_SORT_KEY} asc nulls last`,
    direction: "raw" as const,
  },
  membership_desc: {
    column: sql`${MEMBERSHIP_SORT_KEY} desc nulls last`,
    direction: "raw" as const,
  },
  newest: { column: members.createdAt, direction: "desc" as const },
} satisfies Record<
  MembersSort,
  {
    column: SQL | typeof members.createdAt;
    /** "raw" means the column expression already carries its own direction. */
    direction: "asc" | "desc" | "raw";
  }
>;

/**
 * Free-text search spans every field an operator might recall about a
 * member — not just the name. Enum and numeric columns are cast to text so
 * "photographer", "suspended" or "2026" match too.
 */
function buildSearchCondition(rawQuery: string): SQL | null {
  const q = rawQuery.trim();
  if (!q) return null;
  const term = `%${q}%`;
  const lower = q.toLowerCase();

  const conditions: SQL[] = [
    ilike(members.firstName, term),
    ilike(members.lastName, term),
    // Match against the full name so "Kavya Bhat" finds the member that
    // neither first_name nor last_name alone would.
    // `coalesce` matches the members_name_lower_idx expression: last_name is
    // nullable, and `'x' || NULL` is NULL, which would exclude every
    // single-name member from full-name search.
    sql`trim(${members.firstName} || ' ' || coalesce(${members.lastName}, '')) ilike ${term}`,
    ilike(members.email, term),
    ilike(members.phone, term),
    ilike(members.memberId, term),
    ilike(members.legacyId, term),
    ilike(members.businessName, term),
    ilike(members.addressLine1, term),
    ilike(members.addressLine2, term),
    ilike(members.area, term),
    ilike(members.city, term),
    ilike(members.state, term),
    ilike(members.pincode, term),
    ilike(members.bloodGroup, term),
    ilike(members.notes, term),
    sql`${members.profession}::text ilike ${term}`,
    sql`${members.status}::text ilike ${term}`,
    sql`${members.feesPaidUpto}::text ilike ${term}`,
    sql`${members.dob}::text ilike ${term}`,
  ];

  // Match what the UI actually displays, which differs from the stored
  // enum value / boolean.
  if ("photo & video".includes(lower) || "photo and video".includes(lower)) {
    conditions.push(sql`${members.profession} = 'photo_and_video'`);
  }
  if ("death fund".includes(lower) || lower === "covered") {
    conditions.push(sql`${members.deathFundCovered} = true`);
  }
  if ("due".startsWith(lower) || "unpaid".startsWith(lower)) {
    conditions.push(
      or(
        isNull(members.feesPaidUpto),
        lt(members.feesPaidUpto, new Date().getFullYear()),
      )!,
    );
  }
  if ("paid".startsWith(lower)) {
    conditions.push(
      sql`${members.feesPaidUpto} >= ${new Date().getFullYear()}`,
    );
  }

  return or(...conditions)!;
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
    const search = buildSearchCondition(params.q);
    if (search) conditions.push(search);
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

  return and(...conditions)!;
}

/**
 * Offset pagination with a total count, so the UI can show real page
 * numbers. Offsets are cheap at this table's scale (low thousands) and buy
 * jump-to-page, which keyset cursors can't do. Never loads the full list —
 * always bounded by `perPage`.
 */
export async function searchMembers(
  params: MembersQueryParams,
): Promise<MembersSearchResult> {
  const where = buildMembersWhere(params);
  const activeSort = params.sort ?? DEFAULT_SORT;
  const { column, direction } = SORT_CONFIG[activeSort];

  const perPage = params.perPage ?? DEFAULT_PER_PAGE;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(where);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // Clamp so a stale/typed-in ?page= past the end returns the last page
  // rather than an empty table.
  const page = Math.min(Math.max(1, params.page ?? 1), totalPages);

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
      updatedAt: members.updatedAt,
    })
    .from(members)
    .where(where)
    // `members.id` is the tiebreaker so pagination is stable when the sort
    // key repeats — which membership numbers do, for the members that have
    // none.
    .orderBy(
      direction === "raw" ? column : direction === "asc" ? asc(column) : desc(column),
      asc(members.id),
    )
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { rows, total, page, perPage, totalPages };
}
