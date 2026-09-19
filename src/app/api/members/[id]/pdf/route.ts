import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { isUuid } from "@/lib/members-query";
import {
  getMemberForPdf,
  renderApplicationPdfForRecord,
} from "@/lib/pdf/application-pdf";
import { hasRole } from "@/lib/rbac";

/**
 * Same document as `/api/applications/[id]/pdf`, keyed by member id instead
 * of application id — backs the "Download application" button on the
 * member drawer/detail/edit pages, which only have a member id at hand.
 *
 * Unlike the sibling route, this one is not gated on application status:
 * every member's current record is downloadable here, approved application
 * or not (a ledger-imported member with no application at all gets a PDF
 * with an em-dash where the application number would go). The
 * approved-only gate stays on the applications review page's download
 * button, which is downloading a specific application, not a member.
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

  const data = await getMemberForPdf(id);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { application, member } = data;
  const { buffer, applicationNo } = await renderApplicationPdfForRecord(
    application,
    member,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const filenameRef = applicationNo ?? member.memberId;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mdpva-application-${filenameRef}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
