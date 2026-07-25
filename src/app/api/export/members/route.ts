import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { hasRole } from "@/lib/rbac";
import {
  buildMembersWhere,
  type MembersQueryParams,
  type MemberStatusFilter,
  type ProfessionFilter,
  type MembersSort,
} from "@/lib/members-query";
import { membersToCsv } from "@/lib/csv/member-csv";

function parseParams(searchParams: URLSearchParams): MembersQueryParams {
  const status = searchParams.get("status");
  const profession = searchParams.get("profession");
  const sort = searchParams.get("sort");
  return {
    q: searchParams.get("q") ?? undefined,
    status:
      status === "active" || status === "inactive" || status === "suspended"
        ? (status as MemberStatusFilter)
        : undefined,
    profession:
      profession === "photographer" ||
      profession === "videographer" ||
      profession === "both"
        ? (profession as ProfessionFilter)
        : undefined,
    feesDue: searchParams.get("feesDue") === "true",
    deathFund: searchParams.get("deathFund") === "true",
    sort:
      sort === "name" || sort === "name_desc" || sort === "newest"
        ? (sort as MembersSort)
        : undefined,
    // cursor deliberately ignored — export always covers the full filtered set
  };
}

/**
 * Admin-only CSV export of the members directory. Accepts the same query
 * params as /members, so "export what I'm looking at" is just forwarding
 * the current URL's search string.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = parseParams(request.nextUrl.searchParams);
  const rows = await db
    .select({
      memberId: members.memberId,
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      email: members.email,
      phone: members.phone,
      profession: members.profession,
      businessName: members.businessName,
      addressLine1: members.addressLine1,
      addressLine2: members.addressLine2,
      area: members.area,
      city: members.city,
      state: members.state,
      pincode: members.pincode,
      dob: members.dob,
      bloodGroup: members.bloodGroup,
      status: members.status,
      feesPaidUpto: members.feesPaidUpto,
      deathFundCovered: members.deathFundCovered,
      notes: members.notes,
    })
    .from(members)
    .where(buildMembersWhere(params))
    .orderBy(asc(members.lastName), asc(members.id));

  const csv = membersToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mdpva-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
