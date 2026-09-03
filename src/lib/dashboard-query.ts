import { desc, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";

export interface DashboardStats {
  total: number;
  active: number;
  feesDue: number;
  deathFundCovered: number;
  professions: {
    profession:
      | "photographer"
      | "videographer"
      | "photo_and_video"
      | "drone_operator";
    count: number;
  }[];
  recent: {
    id: string;
    memberId: string;
    legacyId: string | null;
    firstName: string;
    lastName: string | null;
    profession:
      | "photographer"
      | "videographer"
      | "photo_and_video"
      | "drone_operator"
      | null;
    photoKey: string | null;
    updatedAt: Date;
    createdAt: Date;
  }[];
}

/**
 * All dashboard numbers in two round-trips (aggregates + recent list).
 * "Fees due" counts only active members — inactive/suspended members are
 * not chased for the current year's fee.
 */
export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const year = now.getFullYear();

  const [aggregates] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${members.status} = 'active')::int`,
      feesDue: sql<number>`count(*) filter (where ${members.status} = 'active' and (${members.feesPaidUpto} is null or ${members.feesPaidUpto} < ${year}))::int`,
      deathFundCovered: sql<number>`count(*) filter (where ${members.deathFundCovered})::int`,
      photographers: sql<number>`count(*) filter (where ${members.profession} = 'photographer')::int`,
      videographers: sql<number>`count(*) filter (where ${members.profession} = 'videographer')::int`,
      photoAndVideo: sql<number>`count(*) filter (where ${members.profession} = 'photo_and_video')::int`,
      droneOperators: sql<number>`count(*) filter (where ${members.profession} = 'drone_operator')::int`,
    })
    .from(members)
    .where(isNull(members.deletedAt));

  const recent = await db
    .select({
      id: members.id,
      memberId: members.memberId,
      // Selected so the card can lead with the membership number and fall
      // back to the generated id for members who have none yet.
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      profession: members.profession,
      photoKey: members.photoKey,
      updatedAt: members.updatedAt,
      createdAt: members.createdAt,
    })
    .from(members)
    .where(isNull(members.deletedAt))
    .orderBy(desc(members.createdAt), desc(members.id))
    .limit(5);

  return {
    total: aggregates?.total ?? 0,
    active: aggregates?.active ?? 0,
    feesDue: aggregates?.feesDue ?? 0,
    deathFundCovered: aggregates?.deathFundCovered ?? 0,
    professions: [
      { profession: "photographer", count: aggregates?.photographers ?? 0 },
      { profession: "videographer", count: aggregates?.videographers ?? 0 },
      {
        profession: "photo_and_video",
        count: aggregates?.photoAndVideo ?? 0,
      },
      {
        profession: "drone_operator",
        count: aggregates?.droneOperators ?? 0,
      },
    ],
    recent,
  };
}
