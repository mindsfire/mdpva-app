import { describe, expect, it } from "vitest";

import { applicationInputSchema } from "./application";

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
    // Verhoeff-valid test number — see aadhaar.test.ts for how it was derived.
    aadhaar: "234567890124",
    ...overrides,
  };
}

describe("applicationInputSchema", () => {
  it("accepts a fully valid application", () => {
    const result = applicationInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  describe("profession", () => {
    it("accepts photographer, videographer, photo_and_video, drone_operator", () => {
      for (const value of [
        "photographer",
        "videographer",
        "photo_and_video",
        "drone_operator",
      ]) {
        const result = applicationInputSchema.safeParse(
          validInput({ profession: value }),
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.profession).toBe(value);
        }
      }
    });

    it("rejects an invalid profession value", () => {
      const result = applicationInputSchema.safeParse(
        validInput({ profession: "chef" }),
      );
      expect(result.success).toBe(false);
    });

    it("is required — rejects null/empty/missing, unlike the admin schema", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ profession: null }))
          .success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ profession: "" }))
          .success,
      ).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding profession to build a rest object without it
      const { profession: _drop, ...rest } = validInput();
      expect(applicationInputSchema.safeParse(rest).success).toBe(false);
    });
  });

  describe("aadhaar", () => {
    it("accepts a valid Aadhaar number, loosely formatted", () => {
      const result = applicationInputSchema.safeParse(
        validInput({ aadhaar: "2345 6789 0124" }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.aadhaar).toBe("234567890124");
      }
    });

    it("is required — rejects null/empty/missing", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ aadhaar: null })).success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ aadhaar: "" })).success,
      ).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding aadhaar to build a rest object without it
      const { aadhaar: _drop, ...rest } = validInput();
      expect(applicationInputSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects the wrong length", () => {
      const result = applicationInputSchema.safeParse(
        validInput({ aadhaar: "23456789012" }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects a number starting with 0 or 1", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ aadhaar: "034567890128" }))
          .success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ aadhaar: "134567890127" }))
          .success,
      ).toBe(false);
    });

    it("rejects a bad Verhoeff checksum", () => {
      const result = applicationInputSchema.safeParse(
        // Last digit of the valid test number bumped by one.
        validInput({ aadhaar: "234567890125" }),
      );
      expect(result.success).toBe(false);
    });
  });
});
