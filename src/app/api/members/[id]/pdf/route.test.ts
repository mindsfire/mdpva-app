import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pdf/application-pdf", () => ({
  getMemberForPdf: vi.fn(),
  renderApplicationPdfForRecord: vi.fn(
    async (application: { applicationNo: string } | null) => ({
      buffer: Buffer.from("%PDF-fake"),
      applicationNo: application?.applicationNo ?? null,
    }),
  ),
}));

import { auth } from "@/auth";
import { getMemberForPdf } from "@/lib/pdf/application-pdf";
import { GET } from "./route";

const MEMBER_ID = "22222222-2222-2222-2222-222222222222";

const mockAuth = vi.mocked(auth);
const mockGetMemberForPdf = vi.mocked(getMemberForPdf);

function request() {
  return new NextRequest(`http://localhost/api/members/${MEMBER_ID}/pdf`);
}

function call(id: string) {
  return GET(request(), { params: Promise.resolve({ id }) });
}

function memberRecord(
  application: { applicationNo: string; status: string; reviewedAt: Date | null } | null,
) {
  return {
    application,
    member: {
      id: MEMBER_ID,
      firstName: "Asha",
      lastName: "Rao",
      legacyId: "42",
      memberId: "MDPVA-2026-0001",
      photoKey: null,
    },
  } as unknown as NonNullable<Awaited<ReturnType<typeof getMemberForPdf>>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/members/[id]/pdf", () => {
  it("404s when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await call(MEMBER_ID);
    expect(res.status).toBe(404);
    expect(mockGetMemberForPdf).not.toHaveBeenCalled();
  });

  it("404s for a non-admin session", async () => {
    mockAuth.mockResolvedValue({ user: { role: "editor" } } as never);
    const res = await call(MEMBER_ID);
    expect(res.status).toBe(404);
    expect(mockGetMemberForPdf).not.toHaveBeenCalled();
  });

  it("404s on a malformed id, never reaching the database", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    const res = await call("not-a-uuid");
    expect(res.status).toBe(404);
    expect(mockGetMemberForPdf).not.toHaveBeenCalled();
  });

  it("404s when the member doesn't exist", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetMemberForPdf.mockResolvedValue(null);
    const res = await call(MEMBER_ID);
    expect(res.status).toBe(404);
  });

  it("streams a PDF for a member with an approved application", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetMemberForPdf.mockResolvedValue(
      memberRecord({
        applicationNo: "APP-7K4M2X",
        status: "approved",
        reviewedAt: new Date("2026-07-31T10:00:00Z"),
      }),
    );

    const res = await call(MEMBER_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="mdpva-application-APP-7K4M2X-',
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString("latin1")).toBe("%PDF-fake");
  });

  it("streams a PDF for a member with no application at all, keyed by member id in the filename", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetMemberForPdf.mockResolvedValue(memberRecord(null));

    const res = await call(MEMBER_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="mdpva-application-MDPVA-2026-0001-',
    );
  });

  it("streams a PDF for a member whose only application was rejected", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetMemberForPdf.mockResolvedValue(
      memberRecord({
        applicationNo: "APP-9Z8X7Y",
        status: "rejected",
        reviewedAt: new Date("2026-06-01T10:00:00Z"),
      }),
    );

    const res = await call(MEMBER_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="mdpva-application-APP-9Z8X7Y-',
    );
  });
});
