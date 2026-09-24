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
    professionOther: "",
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
    nomineeName: "Lakshmi Rao",
    nomineeRelationship: "Spouse",
    nomineePhone: "9845022345",
    ...overrides,
  };
}

describe("applicationInputSchema", () => {
  it("accepts a fully valid application", () => {
    const result = applicationInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  describe("lastName", () => {
    it("is optional — accepts null/empty, unlike first name", () => {
      for (const override of [
        { lastName: null },
        { lastName: "" },
      ] as const) {
        const result = applicationInputSchema.safeParse(
          validInput(override),
        );
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.lastName).toBeNull();
      }
    });
  });

  describe("profession", () => {
    it("accepts photographer, videographer, photo_and_video", () => {
      for (const value of [
        "photographer",
        "videographer",
        "photo_and_video",
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

    it("rejects drone_operator — removed from the public form", () => {
      const result = applicationInputSchema.safeParse(
        validInput({ profession: "drone_operator" }),
      );
      expect(result.success).toBe(false);
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

    describe("other", () => {
      it("accepts 'other' with a description", () => {
        const result = applicationInputSchema.safeParse(
          validInput({ profession: "other", professionOther: "Framing" }),
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.professionOther).toBe("Framing");
        }
      });

      it("rejects 'other' without a description", () => {
        const result = applicationInputSchema.safeParse(
          validInput({ profession: "other", professionOther: "" }),
        );
        expect(result.success).toBe(false);
      });

      it("rejects a description over the character limit", () => {
        const result = applicationInputSchema.safeParse(
          validInput({
            profession: "other",
            professionOther: "x".repeat(41),
          }),
        );
        expect(result.success).toBe(false);
      });

      it("discards a description left over from a different profession", () => {
        const result = applicationInputSchema.safeParse(
          validInput({
            profession: "photographer",
            professionOther: "Framing",
          }),
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.professionOther).toBeNull();
        }
      });
    });
  });

  describe("pincode", () => {
    it("is required — rejects null/empty/missing", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ pincode: null }))
          .success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ pincode: "" })).success,
      ).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding pincode to build a rest object without it
      const { pincode: _drop, ...rest } = validInput();
      expect(applicationInputSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects a value that isn't 6 digits", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ pincode: "5600" }))
          .success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ pincode: "560038a" }))
          .success,
      ).toBe(false);
    });
  });

  describe("dob", () => {
    it("is required — rejects null/empty/missing", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ dob: null })).success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ dob: "" })).success,
      ).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding dob to build a rest object without it
      const { dob: _drop, ...rest } = validInput();
      expect(applicationInputSchema.safeParse(rest).success).toBe(false);
    });
  });

  describe("bloodGroup", () => {
    it("is required — rejects null/empty/missing", () => {
      expect(
        applicationInputSchema.safeParse(validInput({ bloodGroup: null }))
          .success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(validInput({ bloodGroup: "" }))
          .success,
      ).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding bloodGroup to build a rest object without it
      const { bloodGroup: _drop, ...rest } = validInput();
      expect(applicationInputSchema.safeParse(rest).success).toBe(false);
    });

    it("accepts \"Don't know\"", () => {
      expect(
        applicationInputSchema.safeParse(
          validInput({ bloodGroup: "Don't know" }),
        ).success,
      ).toBe(true);
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

  describe("nominee", () => {
    it("requires name, relationship and phone", () => {
      for (const field of [
        "nomineeName",
        "nomineeRelationship",
        "nomineePhone",
      ]) {
        for (const blank of [null, "", "   "]) {
          const result = applicationInputSchema.safeParse(
            validInput({ [field]: blank }),
          );
          expect(result.success, `${field}=${JSON.stringify(blank)}`).toBe(
            false,
          );
          expect(result.error?.issues[0]?.path[0]).toBe(field);
        }
      }
    });

    it("accepts only the listed relationships", () => {
      expect(
        applicationInputSchema.safeParse(
          validInput({ nomineeRelationship: "Friend" }),
        ).success,
      ).toBe(false);
      expect(
        applicationInputSchema.safeParse(
          validInput({ nomineeRelationship: "Daughter" }),
        ).success,
      ).toBe(true);
    });

    it("stores the nominee phone as bare 10 digits, never the raw text", () => {
      for (const raw of ["+91 98450 22345", "098450-22345", "98450<b>22345 x"]) {
        const result = applicationInputSchema.safeParse(
          validInput({ nomineePhone: raw }),
        );
        expect(result.success, raw).toBe(true);
        expect(result.data?.nomineePhone).toBe("9845022345");
      }
    });

    it("holds the nominee phone to the mobile-number rule", () => {
      const result = applicationInputSchema.safeParse(
        validInput({ nomineePhone: "12345" }),
      );
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path[0]).toBe("nomineePhone");
    });
  });
});
