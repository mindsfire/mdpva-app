import { describe, expect, it } from "vitest";

import { hasRole, roleOrder } from "@/lib/rbac";

describe("roleOrder", () => {
  it("orders viewer < editor < admin", () => {
    expect(roleOrder.viewer).toBeLessThan(roleOrder.editor);
    expect(roleOrder.editor).toBeLessThan(roleOrder.admin);
  });
});

describe("hasRole", () => {
  it("allows a role that meets the minimum", () => {
    expect(hasRole("editor", "viewer")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
  });

  it("allows a role above the minimum", () => {
    expect(hasRole("admin", "viewer")).toBe(true);
    expect(hasRole("admin", "editor")).toBe(true);
  });

  it("rejects a role below the minimum", () => {
    expect(hasRole("viewer", "editor")).toBe(false);
    expect(hasRole("viewer", "admin")).toBe(false);
    expect(hasRole("editor", "admin")).toBe(false);
  });
});
