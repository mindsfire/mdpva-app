import { describe, expect, it } from "vitest";

import {
  applicationCorrectionSchema,
  applicationInputSchema,
  CORRECTABLE_FIELDS,
} from "./application";

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
    // Matches what the onboard form sends: one address field, no line 2 key.
    addressLine1: "12 MG Road",
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

  describe("address", () => {
    it("accepts an application with no addressLine2 key at all", () => {
      // The onboard form has a single address field and doesn't send line 2.
      // A schema that still declared it rejected every real submission with
      // "expected nonoptional, received undefined".
      const input = validInput({ addressLine1: "#85, Allanahalli Layout" });
      expect("addressLine2" in input).toBe(false);
      const result = applicationInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addressLine1).toBe("#85, Allanahalli Layout");
      }
    });

    it("drops an addressLine2 a client sends anyway", () => {
      // Line 2 isn't member-editable any more; approval clears the old one,
      // so a crafted request mustn't be able to write it back.
      const result = applicationInputSchema.safeParse(
        validInput({ addressLine2: "Near temple" }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect("addressLine2" in result.data).toBe(false);
      }
    });

    it("accepts a 200-character address but not 201", () => {
      // One field now holds the whole address, so the cap is wider than the
      // old per-line 120.
      expect(
        applicationInputSchema.safeParse(validInput({ addressLine1: "a".repeat(200) }))
          .success,
      ).toBe(true);
      expect(
        applicationInputSchema.safeParse(validInput({ addressLine1: "a".repeat(201) }))
          .success,
      ).toBe(false);
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

    it("is optional — null/empty/missing become null", () => {
      for (const aadhaar of [null, "", "   "]) {
        const result = applicationInputSchema.safeParse(validInput({ aadhaar }));
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.aadhaar).toBeNull();
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarding aadhaar to build a rest object without it
      const { aadhaar: _drop, ...rest } = validInput();
      const result = applicationInputSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.aadhaar).toBeNull();
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

  it("stores the member phone as bare 10 digits, never the raw text", () => {
    for (const raw of ["+91 98450 11234", "098450-11234", "98450<b>11234 hello"]) {
      const result = applicationInputSchema.safeParse(validInput({ phone: raw }));
      expect(result.success, raw).toBe(true);
      expect(result.data?.phone).toBe("9845011234");
    }
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

describe("applicationCorrectionSchema", () => {
  function validCorrection(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      firstName: "Asha Rao",
      businessName: "Asha Studios",
      addressLine1: "12 MG Road",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      email: "asha@example.com",
      nomineeName: "Lakshmi Rao",
      nomineeRelationship: "Spouse",
      ...overrides,
    };
  }

  it("accepts a valid correction", () => {
    expect(applicationCorrectionSchema.safeParse(validCorrection()).success).toBe(true);
  });

  it("tidies spacing but leaves capitalisation as the admin typed it", () => {
    const result = applicationCorrectionSchema.safeParse(
      validCorrection({ firstName: "  asha   RAO ", city: " Bengaluru  " }),
    );
    expect(result.success && result.data.firstName).toBe("asha RAO");
    expect(result.success && result.data.city).toBe("Bengaluru");
  });

  it("applies the public form's rules", () => {
    expect(
      applicationCorrectionSchema.safeParse(validCorrection({ firstName: "Asha 2" })).success,
    ).toBe(false);
    expect(
      applicationCorrectionSchema.safeParse(validCorrection({ pincode: "5600" })).success,
    ).toBe(false);
    expect(
      applicationCorrectionSchema.safeParse(validCorrection({ city: "  " })).success,
    ).toBe(false);
    expect(
      applicationCorrectionSchema.safeParse(
        validCorrection({ nomineeRelationship: "Cousin" }),
      ).success,
    ).toBe(false);
  });

  it("stores a blanked optional field as null", () => {
    const result = applicationCorrectionSchema.safeParse(
      validCorrection({ businessName: "", area: " ", email: "" }),
    );
    expect(result.success && result.data).toMatchObject({
      businessName: null,
      area: null,
      email: null,
    });
  });

  it("never passes through identity fields, even if sent", () => {
    const result = applicationCorrectionSchema.safeParse(
      validCorrection({
        phone: "9845099999",
        aadhaar: "234567890124",
        dob: "1980-01-01",
        photoKey: "members/x.webp",
        status: "approved",
      }),
    );
    expect(result.success).toBe(true);
    const keys = Object.keys(result.success ? result.data : {});
    for (const forbidden of ["phone", "aadhaar", "dob", "photoKey", "status"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("lists exactly the correctable fields", () => {
    expect([...CORRECTABLE_FIELDS].sort()).toEqual(
      [
        "addressLine1",
        "area",
        "businessName",
        "city",
        "email",
        "firstName",
        "nomineeName",
        "nomineeRelationship",
        "pincode",
        "state",
      ].sort(),
    );
  });
});
