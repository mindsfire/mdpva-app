"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

const BCRYPT_COST = 12;

const changePasswordSchema = z.object({
  current: z.string().min(1, "Current password is required."),
  next: z.string().min(10, "New password must be at least 10 characters."),
});

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

/**
 * Every server action must start with a role check — even the lowest bar
 * (`viewer`) confirms there's a valid, active session before doing anything.
 */
export async function changePasswordAction(
  current: string,
  next: string,
): Promise<ChangePasswordState> {
  const sessionUser = await requireRole("viewer");

  const parsed = changePasswordSchema.safeParse({ current, next });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!user) {
    return { error: "Invalid current password." };
  }

  const currentMatches = await bcrypt.compare(
    parsed.data.current,
    user.passwordHash,
  );
  if (!currentMatches) {
    return { error: "Invalid current password." };
  }

  const nextHash = await bcrypt.hash(parsed.data.next, BCRYPT_COST);

  await db
    .update(users)
    .set({
      passwordHash: nextHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { success: true };
}

export interface LoginState {
  error?: string;
}

/**
 * Called from the login form. With `redirect: false`, Auth.js v5 doesn't
 * throw on a credentials failure — it returns a redirect URL carrying
 * `error`/`code` query params, which we translate back to generic copy.
 */
export async function loginAction(
  email: string,
  password: string,
): Promise<LoginState> {
  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  const url = new URL(result, "http://localhost");
  const error = url.searchParams.get("error");
  if (!error) return {};

  const code = url.searchParams.get("code");
  if (code === "locked") {
    return {
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }
  return { error: "Invalid email or password." };
}

export async function requireSession() {
  return auth();
}
