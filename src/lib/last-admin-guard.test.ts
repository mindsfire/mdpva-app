import { describe, expect, it } from "vitest";

import { wouldRemoveLastAdmin, type AdminGuardUser } from "./last-admin-guard";

const admin1: AdminGuardUser = { id: "1", role: "admin", status: "active" };
const admin2: AdminGuardUser = { id: "2", role: "admin", status: "active" };
const disabledAdmin: AdminGuardUser = {
  id: "3",
  role: "admin",
  status: "disabled",
};
const editor: AdminGuardUser = { id: "4", role: "editor", status: "active" };

describe("wouldRemoveLastAdmin", () => {
  it("blocks demoting the sole active admin", () => {
    expect(
      wouldRemoveLastAdmin([admin1, editor], "1", { role: "editor" }),
    ).toBe(true);
  });

  it("blocks disabling the sole active admin", () => {
    expect(
      wouldRemoveLastAdmin([admin1, editor], "1", { status: "disabled" }),
    ).toBe(true);
  });

  it("allows demoting an admin when another active admin remains", () => {
    expect(
      wouldRemoveLastAdmin([admin1, admin2], "1", { role: "editor" }),
    ).toBe(false);
  });

  it("allows disabling an admin when another active admin remains", () => {
    expect(
      wouldRemoveLastAdmin([admin1, admin2], "1", { status: "disabled" }),
    ).toBe(false);
  });

  it("does not count an already-disabled admin toward the active total", () => {
    // disabledAdmin doesn't prop up the count, so demoting admin1 (the only
    // active admin) is still blocked even though a second admin row exists.
    expect(
      wouldRemoveLastAdmin([admin1, disabledAdmin], "1", { role: "editor" }),
    ).toBe(true);
  });

  it("allows changes to a non-admin target regardless of admin count", () => {
    expect(
      wouldRemoveLastAdmin([admin1], "4", { status: "disabled" }),
    ).toBe(false);
  });

  it("allows a change that keeps the target an active admin", () => {
    expect(
      wouldRemoveLastAdmin([admin1], "1", { role: "admin", status: "active" }),
    ).toBe(false);
  });

  it("returns false for an unknown target id", () => {
    expect(wouldRemoveLastAdmin([admin1], "unknown", { role: "editor" })).toBe(
      false,
    );
  });

  it("blocks re-disabling an already-disabled sole-admin scenario as a no-op false (not currently active)", () => {
    // disabledAdmin is not currently an active admin, so changing it further
    // is never blocked by this guard (it's already not counted).
    expect(
      wouldRemoveLastAdmin([disabledAdmin], "3", { status: "disabled" }),
    ).toBe(false);
  });
});
