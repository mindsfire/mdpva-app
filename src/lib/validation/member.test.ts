import { describe, expect, it } from "vitest";

import { memberInputSchema } from "./member";

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    // Deliberately not 9876543210 — that descending run is rejected as ledger
    // placeholder junk (see `normalizePhone`), which is the intended behaviour.
    phone: "9845011234",
    profession: "photographer",
    businessName: "Asha Studios",
    addressLine1: "12 MG Road",
    addressLine2: "",
    area: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    dob: "1990-01-01",
    bloodGroup: "O+",
    status: "active",
    feesPaidUpto: 2026,
    deathFundCovered: false,
    notes: "",
    legacyId: "",
    ...overrides,
  };
}

describe("memberInputSchema", () => {
  it("accepts a fully valid member", () => {
    const result = memberInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("requires firstName, addressLine1, city, state", () => {
    for (const field of ["firstName", "addressLine1", "city", "state"]) {
      const result = memberInputSchema.safeParse(validInput({ [field]: "" }));
      expect(result.success, `${field} should be required`).toBe(false);
    }
  });

  describe("lastName", () => {
    // Many Kannada names have no separable surname, and 484 of the 1360
    // legacy ledger members are recorded as a single name.
    it("accepts a member with no last name", () => {
      const result = memberInputSchema.safeParse(validInput({ lastName: "" }));
      expect(result.success).toBe(true);
    });

    it.each([["" as const], [null], [undefined]])(
      "normalises %p to null rather than an empty string",
      (value) => {
        const result = memberInputSchema.safeParse(
          validInput({ lastName: value }),
        );
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.lastName).toBeNull();
      },
    );

    it("still rejects a last name with disallowed characters", () => {
      const result = memberInputSchema.safeParse(
        validInput({ lastName: "Bhat99" }),
      );
      expect(result.success).toBe(false);
    });

    it("keeps a real last name", () => {
      const result = memberInputSchema.safeParse(
        validInput({ lastName: "Bhat" }),
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.lastName).toBe("Bhat");
    });
  });

  describe("pincode", () => {
    it("accepts a 6-digit pincode", () => {
      expect(memberInputSchema.safeParse(validInput({ pincode: "560001" })).success).toBe(true);
    });

    it("rejects a pincode with letters", () => {
      expect(memberInputSchema.safeParse(validInput({ pincode: "56000A" })).success).toBe(false);
    });

    it("rejects a pincode with the wrong length", () => {
      expect(memberInputSchema.safeParse(validInput({ pincode: "5600" })).success).toBe(false);
      expect(memberInputSchema.safeParse(validInput({ pincode: "5600011" })).success).toBe(false);
    });

    it("treats empty string as null (optional)", () => {
      const result = memberInputSchema.safeParse(validInput({ pincode: "" }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pincode).toBeNull();
      }
    });
  });

  describe("profession enum", () => {
    it("accepts photographer, videographer, both", () => {
      for (const value of ["photographer", "videographer", "both"]) {
        expect(memberInputSchema.safeParse(validInput({ profession: value })).success).toBe(true);
      }
    });

    it("rejects an invalid profession value", () => {
      expect(memberInputSchema.safeParse(validInput({ profession: "chef" })).success).toBe(false);
    });

    it("treats null/undefined as allowed (optional)", () => {
      expect(memberInputSchema.safeParse(validInput({ profession: null })).success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding profession to build a rest object without it
      const { profession: _drop, ...rest } = validInput();
      expect(memberInputSchema.safeParse(rest).success).toBe(true);
    });
  });

  describe("status enum", () => {
    it("accepts active, inactive, suspended", () => {
      for (const value of ["active", "inactive", "suspended"]) {
        expect(memberInputSchema.safeParse(validInput({ status: value })).success).toBe(true);
      }
    });

    it("rejects an invalid status value", () => {
      expect(memberInputSchema.safeParse(validInput({ status: "banned" })).success).toBe(false);
    });
  });

  describe("legacyId", () => {
    it("trims an empty string to null", () => {
      const result = memberInputSchema.safeParse(validInput({ legacyId: "" }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.legacyId).toBeNull();
      }
    });

    it("keeps a provided legacyId", () => {
      const result = memberInputSchema.safeParse(validInput({ legacyId: "LEG-001" }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.legacyId).toBe("LEG-001");
      }
    });
  });

  describe("optional contact fields", () => {
    it("trims empty email/phone/businessName/notes to null", () => {
      const result = memberInputSchema.safeParse(
        validInput({ email: "", phone: "", businessName: "", notes: "" }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBeNull();
        expect(result.data.phone).toBeNull();
        expect(result.data.businessName).toBeNull();
        expect(result.data.notes).toBeNull();
      }
    });

    it("rejects a malformed email when provided", () => {
      expect(memberInputSchema.safeParse(validInput({ email: "not-an-email" })).success).toBe(false);
    });
  });

  describe("feesPaidUpto", () => {
    it("accepts a year number", () => {
      expect(memberInputSchema.safeParse(validInput({ feesPaidUpto: 2027 })).success).toBe(true);
    });

    it("accepts null", () => {
      expect(memberInputSchema.safeParse(validInput({ feesPaidUpto: null })).success).toBe(true);
    });
  });

  describe("deathFundCovered", () => {
    it("defaults to false when omitted", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding deathFundCovered to build a rest object without it
      const { deathFundCovered: _drop, ...rest } = validInput();
      const result = memberInputSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deathFundCovered).toBe(false);
      }
    });
  });

  it("does not include member_id in the schema shape", () => {
    expect("memberId" in memberInputSchema.shape).toBe(false);
  });
});
