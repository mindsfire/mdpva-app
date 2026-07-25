"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { mapUniqueViolation } from "@/lib/db-errors";
import { wouldRemoveLastAdmin, type AdminGuardUser } from "@/lib/last-admin-guard";
import { requireRole, type Role } from "@/lib/rbac";
import { generateTempPassword } from "@/lib/temp-password";

const BCRYPT_COST = 12;
const USERS_PATH = "/users";
const LAST_ADMIN_ERROR = "Cannot remove the last admin";

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: "active" | "disabled";
  createdAt: Date;
}

/** Admin only. Lists all users, most recently created first. */
export async function listUsers(): Promise<UserRow[]> {
  await requireRole("admin");

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.email));
}

async function loadGuardUsers(): Promise<AdminGuardUser[]> {
  return db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users);
}

export type UserActionResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string; field?: string };

export type SimpleActionResult = { ok: true } | { ok: false; error: string };

/**
 * Admin only. Creates a new user with a fresh crypto-random temp password;
 * the account must change it on first login. The plaintext password is
 * returned once and never persisted or logged.
 */
export async function createUser(
  name: string,
  email: string,
  role: Role,
): Promise<UserActionResult> {
  await requireRole("admin");

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    return { ok: false, error: "Email is required.", field: "email" };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

  try {
    await db.insert(users).values({
      name: trimmedName || null,
      email: trimmedEmail,
      passwordHash,
      role,
      status: "active",
      mustChangePassword: true,
    });

    revalidatePath(USERS_PATH);
    return { ok: true, tempPassword };
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) {
      return { ok: false, error: mapped.error, field: mapped.field };
    }
    throw err;
  }
}

/**
 * Admin only. Issues a fresh temp password for an existing user: bumps
 * `token_version` (invalidating every existing session for that user) and
 * sets `must_change_password`. Returned once, never persisted in plaintext.
 */
export async function resetUserPassword(id: string): Promise<UserActionResult> {
  await requireRole("admin");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!updated) {
    return { ok: false, error: "User not found." };
  }

  revalidatePath(USERS_PATH);
  return { ok: true, tempPassword };
}

/**
 * Admin only. Changes a user's role, guarded against demoting the last
 * active admin — enforced server-side against a fresh read of every user's
 * role/status, immediately before the write.
 */
export async function setUserRole(
  id: string,
  role: Role,
): Promise<SimpleActionResult> {
  await requireRole("admin");

  const guardUsers = await loadGuardUsers();
  if (wouldRemoveLastAdmin(guardUsers, id, { role })) {
    return { ok: false, error: LAST_ADMIN_ERROR };
  }

  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!updated) {
    return { ok: false, error: "User not found." };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
}

/**
 * Admin only. Enables/disables a user, guarded against disabling the last
 * active admin. Disabling also bumps `token_version` so any live session
 * for that user is invalidated immediately.
 */
export async function setUserStatus(
  id: string,
  status: "active" | "disabled",
): Promise<SimpleActionResult> {
  await requireRole("admin");

  const guardUsers = await loadGuardUsers();
  if (wouldRemoveLastAdmin(guardUsers, id, { status })) {
    return { ok: false, error: LAST_ADMIN_ERROR };
  }

  const [updated] = await db
    .update(users)
    .set({
      status,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!updated) {
    return { ok: false, error: "User not found." };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
}
