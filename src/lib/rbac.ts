import { redirect } from "next/navigation";

export type Role = "viewer" | "editor" | "admin";

/** viewer < editor < admin */
export const roleOrder: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: Role;
  tokenVersion: number;
  mustChangePassword: boolean;
}

/** Pure comparison: does `role` meet or exceed `minRole`? */
export function hasRole(role: Role, minRole: Role): boolean {
  return roleOrder[role] >= roleOrder[minRole];
}

/**
 * Every server action must call this first. Redirects to `/login` if there
 * is no session, and to `/` if the session's role doesn't meet `minRole`.
 */
export async function requireRole(minRole: Role): Promise<SessionUser> {
  // Dynamic import keeps `next-auth` (and its `next/server` dependency) out
  // of the module graph for pure unit tests of `hasRole`/`roleOrder`.
  const { auth } = await import("@/auth");
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  if (!hasRole(user.role, minRole)) {
    redirect("/");
  }

  return user;
}
