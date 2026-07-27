import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

/**
 * The capability granted by passing verification.
 *
 * This is emphatically *not* a login. It carries one member row id and grants
 * exactly one power: submit or resubmit an application for that member. It
 * confers no read access — the form's prefill is limited to the name already
 * shown on the verify step.
 *
 * Signed rather than stored: a plain cookie holding a member id would let
 * anyone claim any record by editing one value in devtools. Signing with
 * `AUTH_SECRET` means a forged token fails verification. It's stateless by
 * design — a session table for an unauthenticated public form would be a
 * write-amplification and cleanup burden for no security gain, since the JWT
 * already carries its own expiry.
 */
export const ONBOARD_COOKIE = "mdpva_onboard";

/** Long enough to fill a form carefully on a bad connection; short enough to matter. */
const TTL_SECONDS = 2 * 60 * 60;

const ISSUER = "mdpva/onboard";
const AUDIENCE = "mdpva/onboard-form";

/**
 * A lookup succeeded, but the member hasn't confirmed the name is theirs yet.
 *
 * Kept as a separate short-lived token — deliberately NOT a cookie — so no
 * capability exists until a human confirms. Someone who mistypes their card
 * number and lands on a stranger's record must be able to back out without
 * ever having been granted write access to it.
 *
 * Signed rather than returned as a bare member id, or the client could simply
 * post back whichever id it liked and skip verification entirely.
 */
const PENDING_AUDIENCE = "mdpva/onboard-pending";
const PENDING_TTL_SECONDS = 5 * 60;

export interface OnboardSession {
  /** `members.id` this session may submit for. */
  memberId: string;
  /** Ledger number as verified, shown back on the form. */
  ledgerId: string;
  /** Name only — never any other member field. */
  displayName: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/** Issues the pre-confirmation token. Sets no cookie and grants nothing. */
export async function createPendingToken(
  session: OnboardSession,
): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(PENDING_AUDIENCE)
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(secret());
}

/** Verifies a pending token; null if forged, expired, or a session token. */
export async function readPendingToken(
  token: string,
): Promise<OnboardSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      // Audience is what stops a full session token being replayed here, and
      // vice versa — the two must not be interchangeable.
      audience: PENDING_AUDIENCE,
    });
    const { memberId, ledgerId, displayName } = payload as Record<
      string,
      unknown
    >;
    if (
      typeof memberId !== "string" ||
      typeof ledgerId !== "string" ||
      typeof displayName !== "string"
    ) {
      return null;
    }
    return { memberId, ledgerId, displayName };
  } catch {
    return null;
  }
}

export async function createOnboardSession(
  session: OnboardSession,
): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(ONBOARD_COOKIE, token, {
    httpOnly: true, // never readable from JS, so XSS can't lift it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/onboard",
    maxAge: TTL_SECONDS,
  });
}

/** Returns the verified session, or null if absent, expired or tampered with. */
export async function readOnboardSession(): Promise<OnboardSession | null> {
  const store = await cookies();
  const token = store.get(ONBOARD_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const { memberId, ledgerId, displayName } = payload as Record<
      string,
      unknown
    >;
    if (
      typeof memberId !== "string" ||
      typeof ledgerId !== "string" ||
      typeof displayName !== "string"
    ) {
      return null;
    }
    return { memberId, ledgerId, displayName };
  } catch {
    // Expired, wrong signature, wrong issuer/audience — all indistinguishable
    // to the caller on purpose.
    return null;
  }
}

export async function clearOnboardSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: ONBOARD_COOKIE, path: "/onboard" });
}
