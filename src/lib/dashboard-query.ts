import { desc, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { members, type StoredProfession } from "@/db/schema";
import { MISSING_CONDITIONS, type MissingFilter } from "@/lib/members-query";
import { PROFESSIONS, type Profession } from "@/lib/profession";

export interface DashboardStats {
  total: number;
  /** Inactive or suspended. */
  notActive: number;
  /** Active members paid up for the current year. */
  feesPaid: number;
  /** Active members not paid up for the current year. */
  feesDue: number;
  deathFundCovered: number;
  /** Every current profession in display order, then `none` for unset. */
  professions: { profession: Profession | "none"; count: number }[];
  /** Members lacking each detail, keyed like the directory's `?missing=`. */
  missing: Record<MissingFilter, number> & { profession: number };
  recent: {
    id: string;
    memberId: string;
    legacyId: string | null;
    firstName: string;
    profession: StoredProfession | null;
    professionOther: string | null;
    photoKey: string | null;
    updatedAt: Date;
    createdAt: Date;
  }[];
}

/** `count(*)` of the rows matching `condition`, as an int. */
function countWhere(condition: SQL) {
  return sql<number>`count(*) filter (where ${condition})::int`;
}

/**
 * All dashboard numbers in three round-trips (aggregates, profession
 * breakdown, recent list).
 *
 * Fees count only active members — inactive/suspended members are not chased
 * for the current year's fee. The missing-detail counts use the directory's
 * own `MISSING_CONDITIONS`, so each number matches the list it links to.
 */
export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const year = now.getFullYear();
  const live = isNull(members.deletedAt);

  const [aggregates] = await db
    .select({
      total: sql<number>`count(*)::int`,
      notActive: countWhere(sql`${members.status} <> 'active'`),
      feesPaid: countWhere(
        sql`${members.status} = 'active' and ${members.feesPaidUpto} >= ${year}`,
      ),
      feesDue: countWhere(
        sql`${members.status} = 'active' and (${members.feesPaidUpto} is null or ${members.feesPaidUpto} < ${year})`,
      ),
      deathFundCovered: countWhere(sql`${members.deathFundCovered}`),
      noPhoto: countWhere(MISSING_CONDITIONS.photo),
      noPhone: countWhere(MISSING_CONDITIONS.phone),
      noDob: countWhere(MISSING_CONDITIONS.dob),
      noNominee: countWhere(MISSING_CONDITIONS.nominee),
      badCity: countWhere(MISSING_CONDITIONS.city),
    })
    .from(members)
    .where(live);

  const byProfession = await db
    .select({
      profession: members.profession,
      count: sql<number>`count(*)::int`,
    })
    .from(members)
    .where(live)
    .groupBy(members.profession);

  const recent = await db
    .select({
      id: members.id,
      memberId: members.memberId,
      // Selected so the card can lead with the membership number and fall
      // back to the generated id for members who have none yet.
      legacyId: members.legacyId,
      firstName: members.firstName,
      profession: members.profession,
      professionOther: members.professionOther,
      photoKey: members.photoKey,
      updatedAt: members.updatedAt,
      createdAt: members.createdAt,
    })
    .from(members)
    .where(live)
    .orderBy(desc(members.createdAt), desc(members.id))
    .limit(5);

  const countOf = (profession: StoredProfession | null) =>
    byProfession.find((row) => row.profession === profession)?.count ?? 0;
  const noProfession = countOf(null);

  return {
    total: aggregates?.total ?? 0,
    notActive: aggregates?.notActive ?? 0,
    feesPaid: aggregates?.feesPaid ?? 0,
    feesDue: aggregates?.feesDue ?? 0,
    deathFundCovered: aggregates?.deathFundCovered ?? 0,
    professions: [
      ...PROFESSIONS.map((profession) => ({
        profession,
        count: countOf(profession),
      })),
      { profession: "none" as const, count: noProfession },
    ],
    missing: {
      photo: aggregates?.noPhoto ?? 0,
      phone: aggregates?.noPhone ?? 0,
      dob: aggregates?.noDob ?? 0,
      nominee: aggregates?.noNominee ?? 0,
      city: aggregates?.badCity ?? 0,
      profession: noProfession,
    },
    recent,
  };
}
