import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pdf/application-pdf", () => ({
  getApplicationForPdf: vi.fn(),
  buildApplicationPdfSections: vi.fn(() => []),
  renderApplicationPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
}));
vi.mock("@/lib/pdf/photo-for-pdf", () => ({
  fetchMemberPhotoForPdf: vi.fn(async () => null),
}));

import { auth } from "@/auth";
import { getApplicationForPdf } from "@/lib/pdf/application-pdf";
import { GET } from "./route";

const APPLICATION_ID = "11111111-1111-1111-1111-111111111111";

const mockAuth = vi.mocked(auth);
const mockGetApplicationForPdf = vi.mocked(getApplicationForPdf);

function request() {
  return new NextRequest(`http://localhost/api/applications/${APPLICATION_ID}/pdf`);
}

function call(id: string) {
  return GET(request(), { params: Promise.resolve({ id }) });
}

function approvedApplication() {
  return {
    application: {
      id: APPLICATION_ID,
      applicationNo: "APP-7K4M2X",
      status: "approved" as const,
      reviewedAt: new Date("2026-07-31T10:00:00Z"),
    },
    member: {
      id: "22222222-2222-2222-2222-222222222222",
      firstName: "Asha",
      lastName: "Rao",
      legacyId: "42",
      memberId: "MDPVA-2026-0001",
      photoKey: null,
    },
  } as unknown as NonNullable<Awaited<ReturnType<typeof getApplicationForPdf>>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/applications/[id]/pdf", () => {
  it("404s when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await call(APPLICATION_ID);
    expect(res.status).toBe(404);
    expect(mockGetApplicationForPdf).not.toHaveBeenCalled();
  });

  it("404s for a non-admin session", async () => {
    mockAuth.mockResolvedValue({ user: { role: "editor" } } as never);
    const res = await call(APPLICATION_ID);
    expect(res.status).toBe(404);
    expect(mockGetApplicationForPdf).not.toHaveBeenCalled();
  });

  it("404s on a malformed id, never reaching the database", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    const res = await call("not-a-uuid");
    expect(res.status).toBe(404);
    expect(mockGetApplicationForPdf).not.toHaveBeenCalled();
  });

  it("404s when the application doesn't exist", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetApplicationForPdf.mockResolvedValue(null);
    const res = await call(APPLICATION_ID);
    expect(res.status).toBe(404);
  });

  it.each(["pending", "rejected", "superseded"] as const)(
    "404s for a %s application instead of streaming a PDF",
    async (status) => {
      mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
      const data = approvedApplication();
      data.application.status = status;
      mockGetApplicationForPdf.mockResolvedValue(data);

      const res = await call(APPLICATION_ID);
      expect(res.status).toBe(404);
    },
  );

  it("streams a PDF with the right headers for an approved application", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockGetApplicationForPdf.mockResolvedValue(approvedApplication());

    const res = await call(APPLICATION_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="mdpva-application-APP-7K4M2X-',
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString("latin1")).toBe("%PDF-fake");
  });
});
