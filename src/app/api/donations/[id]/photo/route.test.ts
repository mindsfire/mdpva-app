import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, select, send } = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/db", () => ({ db: { select } }));
vi.mock("@/db/schema", () => ({ donations: { id: "id", photoKey: "photoKey" } }));
vi.mock("@/lib/r2", () => ({ r2: { send }, R2_BUCKET: "bucket" }));

import { GET } from "./route";

const ID = "4f7c2a56-0f7e-4a54-9b0d-2f5a4a1c9e11";

function get(id = ID) {
  return GET(new Request("http://test"), { params: Promise.resolve({ id }) });
}

function donationExists() {
  select.mockReturnValue({
    from: () => ({ where: async () => [{ photoKey: `app/donations/${ID}.webp` }] }),
  });
}

describe("GET /api/donations/[id]/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    donationExists();
    send.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
  });

  it("hides the photo from anyone without a session", async () => {
    auth.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["viewer", "editor"])("hides the photo from a %s", async (role) => {
    auth.mockResolvedValue({ user: { role } });
    expect((await get()).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without querying", async () => {
    auth.mockResolvedValue({ user: { role: "admin" } });
    expect((await get("not-a-uuid")).status).toBe(404);
    expect(select).not.toHaveBeenCalled();
  });

  it("streams the photo from this origin to an admin, uncached", async () => {
    auth.mockResolvedValue({ user: { role: "admin" } });
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("is a 404 when the stored object is gone", async () => {
    auth.mockResolvedValue({ user: { role: "admin" } });
    send.mockRejectedValue(new Error("NoSuchKey"));
    expect((await get()).status).toBe(404);
  });
});
