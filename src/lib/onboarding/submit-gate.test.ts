import { describe, expect, it } from "vitest";

import { canSubmitApplication } from "./submit-gate";

describe("canSubmitApplication", () => {
  it("is false with no photo, even when consented", () => {
    expect(
      canSubmitApplication({ consented: true, hasPhoto: false }),
    ).toBe(false);
  });

  it("is false without consent, even with a photo", () => {
    expect(
      canSubmitApplication({ consented: false, hasPhoto: true }),
    ).toBe(false);
  });

  it("is false with neither", () => {
    expect(
      canSubmitApplication({ consented: false, hasPhoto: false }),
    ).toBe(false);
  });

  it("is true with both a photo and consent", () => {
    expect(
      canSubmitApplication({ consented: true, hasPhoto: true }),
    ).toBe(true);
  });
});
