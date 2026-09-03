import { describe, expect, it } from "vitest";

import { isUniqueViolationOn, mapUniqueViolation } from "./db-errors";

describe("mapUniqueViolation", () => {
  it("maps members_email_active to a friendly email message", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "members_email_active",
    });
    expect(result).toEqual({
      field: "email",
      error: "A member with this email already exists.",
    });
  });

  it("maps members_phone_active to a friendly phone message", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "members_phone_active",
    });
    expect(result).toEqual({
      field: "phone",
      error: "A member with this phone number already exists.",
    });
  });

  it("maps members_legacy_id_active to a friendly legacyId message", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "members_legacy_id_active",
    });
    expect(result).toEqual({
      field: "legacyId",
      error: "A member with this legacy ID already exists.",
    });
  });

  it("maps members_aadhaar_hash_active to a friendly aadhaar message", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "members_aadhaar_hash_active",
    });
    expect(result).toEqual({
      field: "aadhaar",
      error: "A member with this Aadhaar number already exists.",
    });
  });

  it("maps members_member_id_unique to a generic message with no field", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "members_member_id_unique",
    });
    expect(result).toEqual({
      field: undefined,
      error: "That member ID is already in use. Please try again.",
    });
  });

  it("maps users_email_unique to a friendly email message", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "users_email_unique",
    });
    expect(result).toEqual({
      field: "email",
      error: "A user with this email already exists.",
    });
  });

  it("returns null for a non-unique-violation error code", () => {
    const result = mapUniqueViolation({
      code: "23503",
      constraint: "members_email_active",
    });
    expect(result).toBeNull();
  });

  it("returns null for an unrecognized constraint name", () => {
    const result = mapUniqueViolation({
      code: "23505",
      constraint: "some_other_constraint",
    });
    expect(result).toBeNull();
  });

  it("returns null for a non-error-shaped value", () => {
    expect(mapUniqueViolation(null)).toBeNull();
    expect(mapUniqueViolation(undefined)).toBeNull();
    expect(mapUniqueViolation("boom")).toBeNull();
    expect(mapUniqueViolation({})).toBeNull();
  });

  it("extracts code/constraint from a nested cause (postgres driver error shape)", () => {
    const result = mapUniqueViolation({
      cause: { code: "23505", constraint: "members_email_active" },
    });
    expect(result).toEqual({
      field: "email",
      error: "A member with this email already exists.",
    });
  });
});

/**
 * Shaped like a real Drizzle failure: the wrapper's `message` is the query
 * text and carries no code, while the Postgres detail sits on `cause`.
 * Matching `err.message` against a constraint name therefore never fires —
 * which silently turned a retry-on-collision loop into dead code once.
 */
function drizzleError(constraint: string, code = "23505") {
  const err = new Error(
    'Failed query: insert into "member_applications" ...\nparams: APP-J5RZ02',
  );
  (err as Error & { cause?: unknown }).cause = { code, constraint };
  return err;
}

describe("isUniqueViolationOn", () => {
  it("matches on the constraint carried by `cause`", () => {
    expect(
      isUniqueViolationOn(
        drizzleError("member_applications_no_unique"),
        "member_applications_no_unique",
      ),
    ).toBe(true);
  });

  it("does not match a different constraint", () => {
    expect(
      isUniqueViolationOn(
        drizzleError("member_applications_one_pending"),
        "member_applications_no_unique",
      ),
    ).toBe(false);
  });

  it("does not match a non-unique-violation error code", () => {
    expect(
      isUniqueViolationOn(
        drizzleError("member_applications_no_unique", "23502"),
        "member_applications_no_unique",
      ),
    ).toBe(false);
  });

  it("is not fooled by the constraint name appearing in the message", () => {
    // The regression this replaces: a message-substring check passes here even
    // though nothing about the error indicates a unique violation.
    const err = new Error("Failed query: ... member_applications_no_unique ...");
    expect(isUniqueViolationOn(err, "member_applications_no_unique")).toBe(false);
  });

  it("handles a driver error that puts code at the top level", () => {
    const err = Object.assign(new Error("dup"), {
      code: "23505",
      constraint: "member_applications_no_unique",
    });
    expect(isUniqueViolationOn(err, "member_applications_no_unique")).toBe(true);
  });

  it.each([null, undefined, "a string", 42])("returns false for %s", (v) => {
    expect(isUniqueViolationOn(v, "anything")).toBe(false);
  });
});
