import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { isUuid } from "@/lib/members-query";
import {
  buildApplicationPdfSections,
  getApplicationForPdf,
  renderApplicationPdf,
} from "@/lib/pdf/application-pdf";
import { fetchMemberPhotoForPdf } from "@/lib/pdf/photo-for-pdf";
import { hasRole } from "@/lib/rbac";

/**
 * Streams a printable PDF of an approved application's current member data.
 *
 * Every failure mode — unauthorized, malformed id, unknown application, or
 * not approved — returns the same bare 404, matching the convention in
 * `export/members/route.ts` and `photos/[...key]/route.ts`: never reveal
 * via a distinct 401/403 that a route (or a specific application) exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const data = await getApplicationForPdf(id);
  if (!data || data.application.status !== "approved") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { application, member } = data;
  const photo = await fetchMemberPhotoForPdf(member.photoKey);
  const sections = buildApplicationPdfSections(member);
  const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ");

  const pdf = await renderApplicationPdf({
    applicationNo: application.applicationNo,
    legacyId: member.legacyId,
    memberId: member.memberId,
    memberName,
    reviewedAt: application.reviewedAt,
    sections,
    photo,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mdpva-application-${application.applicationNo}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
