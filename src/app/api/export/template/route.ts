import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { templateCsv } from "@/lib/csv/member-csv";

/** Admin-only import-template download (header row + one example row). */
export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, "admin")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mdpva-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
