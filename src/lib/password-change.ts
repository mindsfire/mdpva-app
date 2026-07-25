import { z } from "zod";

export const changePasswordSchema = z.object({
  current: z.string().min(1, "Current password is required."),
  next: z.string().min(10, "New password must be at least 10 characters."),
});

export interface PasswordChangeDeps {
  compare: (plain: string, hash: string) => Promise<boolean>;
  hash: (plain: string) => Promise<string>;
}

export interface PasswordChangeUser {
  passwordHash: string;
  tokenVersion: number;
}

export type PasswordChangeResult =
  | {
      ok: true;
      passwordHash: string;
      /**
       * Bumped so every other session carrying the old token_version gets
       * invalidated on its next recheck — a stolen cookie stops working
       * once the real owner changes their password.
       */
      tokenVersion: number;
      mustChangePassword: false;
    }
  | { ok: false; error: string };

/**
 * Pure(ish) decision logic for a password change — db reads/writes and the
 * server-action role check happen in the caller (`changePasswordAction`),
 * so this is unit-testable with fake `compare`/`hash` deps.
 */
export async function computePasswordChange(
  user: PasswordChangeUser,
  input: { current: string; next: string },
  deps: PasswordChangeDeps,
): Promise<PasswordChangeResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const currentMatches = await deps.compare(
    parsed.data.current,
    user.passwordHash,
  );
  if (!currentMatches) {
    return { ok: false, error: "Invalid current password." };
  }

  const passwordHash = await deps.hash(parsed.data.next);

  return {
    ok: true,
    passwordHash,
    tokenVersion: user.tokenVersion + 1,
    mustChangePassword: false,
  };
}
