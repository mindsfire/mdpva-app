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
});
