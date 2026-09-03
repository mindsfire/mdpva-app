import { asc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { hasRole } from "@/lib/rbac";
import {
  buildMembersWhere,
  MEMBERSHIP_SORT_KEY,
  type MembersQueryParams,
  type MemberStatusFilter,
  type ProfessionFilter,
  type MembersSort,
} from "@/lib/members-query";
import {
  ALL_EXPORT_FIELDS,
  membersToCsv,
  type ExportFieldKey,
} from "@/lib/csv/member-csv";

const EXPORT_FIELD_KEYS = new Set<string>(ALL_EXPORT_FIELDS);

/**
 * Narrow the untrusted `?fields=` value to known columns, in canonical order.
 * An absent or fully-invalid param exports every field, so a bookmarked or
 * hand-edited URL degrades to the full export rather than an empty file.
 */
function parseFields(raw: string | null): ExportFieldKey[] {
  if (!raw) return ALL_EXPORT_FIELDS;
  const chosen = new Set(
    raw.split(",").filter((k): k is ExportFieldKey => EXPORT_FIELD_KEYS.has(k)),
  );
  if (chosen.size === 0) return ALL_EXPORT_FIELDS;
  return ALL_EXPORT_FIELDS.filter((k) => chosen.has(k));
}

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
      profession === "photo_and_video" ||
      profession === "drone_operator"
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
  const fields = parseFields(request.nextUrl.searchParams.get("fields"));
  const rows = await db
    .select({
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
    // Always membership-number order (1, 2, 3 …), the numberless members last.
    // The previous `asc(lastName)` collapsed to a random UUID order because
    // every member has a null surname (Kannada single names, schema.ts:63).
    .orderBy(sql`${MEMBERSHIP_SORT_KEY} asc nulls last`, asc(members.id));

  const csv = membersToCsv(rows, fields);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mdpva-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
