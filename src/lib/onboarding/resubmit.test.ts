import { describe, expect, it } from "vitest";

import { canResubmit } from "./resubmit";

describe("canResubmit", () => {
  it("allows resubmission only after a rejection", () => {
    expect(canResubmit("rejected")).toBe(true);
  });

  it("blocks resubmission while pending — an admin is already reviewing it", () => {
    expect(canResubmit("pending")).toBe(false);
  });

  it("blocks resubmission once approved — fixes go through the office instead", () => {
    expect(canResubmit("approved")).toBe(false);
  });

  it("blocks resubmission for a superseded row (defensive — should never occur)", () => {
    expect(canResubmit("superseded")).toBe(false);
  });
});
