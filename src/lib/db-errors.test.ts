import { describe, expect, it } from "vitest";

import { mapUniqueViolation } from "./db-errors";

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
