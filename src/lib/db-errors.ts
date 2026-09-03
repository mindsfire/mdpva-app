const UNIQUE_VIOLATION = "23505";

const CONSTRAINT_MESSAGES: Record<string, { field?: string; error: string }> = {
  members_email_active: {
    field: "email",
    error: "A member with this email already exists.",
  },
  members_phone_active: {
    field: "phone",
    error: "A member with this phone number already exists.",
  },
  members_legacy_id_active: {
    field: "legacyId",
    error: "A member with this legacy ID already exists.",
  },
  members_aadhaar_hash_active: {
    field: "aadhaar",
    error: "A member with this Aadhaar number already exists.",
  },
  members_member_id_unique: {
    error: "That member ID is already in use. Please try again.",
  },
  users_email_unique: {
    field: "email",
    error: "A user with this email already exists.",
  },
};

interface PgErrorShape {
  code?: unknown;
  constraint?: unknown;
}

/** Best-effort extraction of `{ code, constraint }` from a driver error, unwrapping one level of `cause` if present. */
function extractPgError(err: unknown): PgErrorShape | null {
  if (typeof err !== "object" || err === null) return null;
  const candidate = err as Record<string, unknown>;
  if (typeof candidate.code === "string") {
    return { code: candidate.code, constraint: candidate.constraint };
  }
  if (typeof candidate.cause === "object" && candidate.cause !== null) {
    const cause = candidate.cause as Record<string, unknown>;
    if (typeof cause.code === "string") {
      return { code: cause.code, constraint: cause.constraint };
    }
  }
  return null;
}

/**
 * True when `err` is a unique violation on the named constraint.
 *
 * Drizzle wraps driver errors, so `err.message` is the *query text* and
 * `err.code`/`err.constraint` are undefined at the top level — the Postgres
 * detail lives on `cause`. Matching against the message string therefore never
 * fires, which silently turns retry-on-collision logic into dead code.
 */
export function isUniqueViolationOn(err: unknown, constraint: string): boolean {
  const pgError = extractPgError(err);
  return pgError?.code === UNIQUE_VIOLATION && pgError.constraint === constraint;
}

/**
 * Maps a Postgres unique-violation (23505) on one of the `members` table's
 * partial unique indexes to a friendly `{ field, error }` message. Returns
 * `null` for any other error shape/code/constraint so callers can fall back
 * to a generic error.
 */
export function mapUniqueViolation(
  err: unknown,
): { field?: string; error: string } | null {
  const pgError = extractPgError(err);
  if (!pgError || pgError.code !== UNIQUE_VIOLATION) return null;

  const constraint =
    typeof pgError.constraint === "string" ? pgError.constraint : undefined;
  if (!constraint) return null;

  const message = CONSTRAINT_MESSAGES[constraint];
  return message ? { field: message.field, error: message.error } : null;
}
