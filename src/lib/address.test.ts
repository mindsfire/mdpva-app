import { describe, expect, it } from "vitest";

import { joinAddressLines } from "./address";

describe("joinAddressLines", () => {
  it("joins both lines with a comma", () => {
    expect(joinAddressLines("Allanahalli", "Near temple")).toBe("Allanahalli, Near temple");
  });

  it("returns line 1 alone when line 2 is empty", () => {
    expect(joinAddressLines("Allanahalli", null)).toBe("Allanahalli");
    expect(joinAddressLines("Allanahalli", "   ")).toBe("Allanahalli");
  });

  it("returns an empty string when both are empty", () => {
    expect(joinAddressLines(null, undefined)).toBe("");
  });
});
