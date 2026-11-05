import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { memberApplications, members, users } from "@/db/schema";
import { parseApplicationTab } from "@/lib/applications-params";
import { applicationSearchCondition } from "@/lib/applications-query";
import { applicationsToCsv } from "@/lib/csv/application-csv";
import { hasRole } from "@/lib/rbac";

/**
 * Admin-only CSV export of one applications-queue tab. Takes the same
 * `status` and `q` params as /applications, so the button just forwards the
 * current tab and search; `page`/`perPage` are ignored and the file covers
 * every matching application, in the same order the queue shows them.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = parseApplicationTab(searchParams.get("status") ?? undefined);
  const q = searchParams.get("q")?.trim() || undefined;

  const rows = await db
    .select({
      applicationNo: memberApplications.applicationNo,
      status: memberApplications.status,
      legacyId: members.legacyId,
      firstName: memberApplications.firstName,
      phone: memberApplications.phone,
      email: memberApplications.email,
      profession: memberApplications.profession,
      professionOther: memberApplications.professionOther,
      businessName: memberApplications.businessName,
      addressLine1: memberApplications.addressLine1,
      addressLine2: memberApplications.addressLine2,
      area: memberApplications.area,
      city: memberApplications.city,
      state: memberApplications.state,
      pincode: memberApplications.pincode,
      dob: memberApplications.dob,
      bloodGroup: memberApplications.bloodGroup,
      aadhaarLast4: memberApplications.aadhaarLast4,
      nomineeName: memberApplications.nomineeName,
      nomineeRelationship: memberApplications.nomineeRelationship,
      nomineePhone: memberApplications.nomineePhone,
      createdAt: memberApplications.createdAt,
      reviewedAt: memberApplications.reviewedAt,
      reviewerName: users.name,
      reviewerEmail: users.email,
      rejectionReason: memberApplications.rejectionReason,
    })
    .from(memberApplications)
    .innerJoin(members, eq(members.id, memberApplications.memberId))
    .leftJoin(users, eq(users.id, memberApplications.reviewedBy))
    .where(
      and(
        eq(memberApplications.status, status),
        applicationSearchCondition(q) ?? undefined,
      ),
    )
    // Matches `listApplications`: pending oldest first, the rest newest first.
    .orderBy(
      status === "pending"
        ? memberApplications.createdAt
        : desc(memberApplications.createdAt),
      memberApplications.id,
    );

  const csv = applicationsToCsv(rows, status);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mdpva-applications-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
