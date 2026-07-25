import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { dbRateLimitStore } from "@/lib/rate-limit-db";
import {
  checkRateLimit,
  clearFailures,
  recordFailure,
} from "@/lib/rate-limit";
import type { Role } from "@/lib/rbac";

/** Generic copy for every credential failure path — never reveal which part was wrong. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

/**
 * Auth.js only ever exposes an error `code` to the client (never a custom
 * message) for security. We map the code back to generic, non-enumerating
 * copy in the login form — `credentials` (bad email/password/disabled
 * account) and `locked` (rate-limited) get distinct-but-still-generic text.
 */
class InvalidCredentialsError extends CredentialsSignin {
  code = "credentials";
}

class LockedError extends CredentialsSignin {
  code = "locked";
}

/** Re-check `token_version` against the db at most this often (ms). */
const TOKEN_VERSION_RECHECK_MS = 15 * 60 * 1000;

/**
 * Best-effort client IP from proxy headers; used only for rate-limit
 * bucketing. This trusts `x-forwarded-for` as-is, which is only safe behind
 * a platform proxy that overwrites (rather than appends to) the header
 * before it reaches this code — Vercel does this. Self-hosting behind a
 * different/no reverse proxy would let a client spoof this header and
 * evade IP-based rate limiting (the per-email limit is unaffected).
 */
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * A bcrypt hash of an arbitrary constant, compared against on the
 * not-found/inactive-user path so `authorize` takes ~the same amount of
 * time whether or not the account exists — otherwise the missing
 * `bcrypt.compare` call on that path is a timing side-channel that lets an
 * attacker enumerate valid emails by measuring response latency.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$I.xaVRJFhQbzKVrpvcsbAebDFTuwsElBpQR8.tu/KXeJvpi6IyYEy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt", updateAge: TOKEN_VERSION_RECHECK_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const ip = getClientIp(request);

        if (!email || !password) throw new InvalidCredentialsError();

        const rateLimit = await checkRateLimit(email, ip, dbRateLimitStore);
        if (rateLimit.locked) {
          throw new LockedError();
        }

        const [user] = await db
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1);

        if (!user || user.status !== "active") {
          // Always pay the bcrypt cost, even when there's no real hash to
          // check against, so response timing doesn't reveal whether the
          // account exists.
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          await recordFailure(email, ip, dbRateLimitStore);
          throw new InvalidCredentialsError();
        }

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (!passwordMatches) {
          await recordFailure(email, ip, dbRateLimitStore);
          throw new InvalidCredentialsError();
        }

        await clearFailures(email, ip, dbRateLimitStore);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role as Role;
        token.tokenVersion = user.tokenVersion as number;
        token.mustChangePassword = user.mustChangePassword as boolean;
        token.lastVersionCheck = Date.now();
        return token;
      }

      // Re-check token_version periodically (driven by session `updateAge`,
      // or lazily here as a fallback) — kills sessions for users whose
      // password changed or were disabled/role-changed elsewhere.
      const lastCheck = (token.lastVersionCheck as number | undefined) ?? 0;
      const dueForCheck =
        trigger === "update" ||
        Date.now() - lastCheck >= TOKEN_VERSION_RECHECK_MS;

      if (dueForCheck && token.userId) {
        const [current] = await db
          .select({
            tokenVersion: users.tokenVersion,
            role: users.role,
            status: users.status,
            mustChangePassword: users.mustChangePassword,
          })
          .from(users)
          .where(eq(users.id, token.userId as string))
          .limit(1);

        if (!current || current.status !== "active") {
          // Signal an invalid session; session callback below strips it.
          token.invalid = true;
        } else if (trigger === "update") {
          // Explicit client-initiated refresh (e.g. right after this same
          // session changed its own password): adopt the current db values,
          // including a bumped token_version, instead of invalidating —
          // otherwise the session that *just* changed the password would
          // immediately kill itself along with every other session.
          token.role = current.role;
          token.tokenVersion = current.tokenVersion;
          token.mustChangePassword = current.mustChangePassword;
        } else if (current.tokenVersion !== token.tokenVersion) {
          // Periodic background recheck: a mismatch here means some *other*
          // action changed token_version (password change from another
          // session, admin disabling/role-changing the user, etc.) — kill
          // this session.
          token.invalid = true;
        } else {
          token.role = current.role;
          token.mustChangePassword = current.mustChangePassword;
        }
        token.lastVersionCheck = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (token.invalid) {
        // Force an empty/expired-looking session; middleware treats
        // missing userId as unauthenticated.
        session.user = undefined as never;
        return session;
      }

      session.user = {
        ...session.user,
        id: token.userId as string,
        role: token.role as Role,
        tokenVersion: token.tokenVersion as number,
        mustChangePassword: token.mustChangePassword as boolean,
      };
      return session;
    },
  },
});
