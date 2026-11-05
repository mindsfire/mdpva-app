import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: vi.fn() } }));

import { auth } from "@/auth";
import { db } from "@/db";
import { GET } from "./route";

const mockAuth = vi.mocked(auth);
const mockSelect = vi.mocked(db.select);

function call(search = "?status=rejected") {
  return GET(new NextRequest(`http://localhost/api/export/applications${search}`));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export/applications", () => {
  it("404s when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("404s for a non-admin session", async () => {
    mockAuth.mockResolvedValue({ user: { role: "editor" } } as never);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns a CSV attachment named for the tab", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: async () => [],
    };
    mockSelect.mockReturnValue(chain as never);

    const res = await call("?status=rejected&q=asha");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /filename="mdpva-applications-rejected-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    expect(await res.text()).toContain("Rejection reason");
  });
});
