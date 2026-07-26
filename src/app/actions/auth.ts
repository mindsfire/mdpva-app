"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { CredentialsSignin } from "next-auth";

import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { computePasswordChange } from "@/lib/password-change";
import { requireRole } from "@/lib/rbac";

const BCRYPT_COST = 12;

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

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!user) {
    return { error: "Invalid current password." };
  }

  const result = await computePasswordChange(
    user,
    { current, next },
    {
      compare: (plain, hash) => bcrypt.compare(plain, hash),
      hash: (plain) => bcrypt.hash(plain, BCRYPT_COST),
    },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  // Bumping token_version invalidates every *other* session carrying the
  // old value on its next recheck (a stolen cookie stops working); the
  // current session stays valid because the client calls the session
  // `update()` trigger right after this resolves, which adopts the new
  // token_version instead of treating the mismatch as invalidation — see
  // the `trigger === "update"` branch in the `jwt` callback in `src/auth.ts`.
  await db
    .update(users)
    .set({
      passwordHash: result.passwordHash,
      tokenVersion: result.tokenVersion,
      mustChangePassword: result.mustChangePassword,
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
  try {
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
  } catch (err) {
    // With `redirect: false`, Auth.js v5 is documented to return a URL
    // carrying `error`/`code` on a credentials failure — but in practice it
    // still throws the `CredentialsSignin` subclass here, so both paths
    // must be handled or the client never learns the sign-in failed.
    if (err instanceof CredentialsSignin) {
      if (err.code === "locked") {
        return {
          error: "Too many attempts. Please wait a few minutes and try again.",
        };
      }
      return { error: "Invalid email or password." };
    }
    throw err;
  }
}

export async function requireSession() {
  return auth();
}
