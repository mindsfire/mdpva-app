export interface AdminGuardUser {
  id: string;
  role: "viewer" | "editor" | "admin";
  status: "active" | "disabled";
}

/**
 * Pure decision logic shared by `setUserRole` (demotion) and `setUserStatus`
 * (disable): counts *active* admins among `users` and blocks any change to
 * `targetId` that would leave zero active admins. Counting only active
 * admins means a disabled admin never "props up" the count — disabling the
 * second-to-last active admin is blocked exactly like demoting them.
 */
export function wouldRemoveLastAdmin(
  users: AdminGuardUser[],
  targetId: string,
  change: { role?: "viewer" | "editor" | "admin"; status?: "active" | "disabled" },
): boolean {
  const activeAdminCount = users.filter(
    (u) => u.role === "admin" && u.status === "active",
  ).length;

  const target = users.find((u) => u.id === targetId);
  if (!target) return false;

  const isCurrentlyActiveAdmin =
    target.role === "admin" && target.status === "active";
  if (!isCurrentlyActiveAdmin) return false;

  const nextRole = change.role ?? target.role;
  const nextStatus = change.status ?? target.status;
  const wouldStillBeActiveAdmin = nextRole === "admin" && nextStatus === "active";

  // Only the last active admin's own change can drop the count to zero.
  return activeAdminCount === 1 && !wouldStillBeActiveAdmin;
}
