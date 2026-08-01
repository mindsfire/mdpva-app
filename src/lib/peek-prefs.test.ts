import { describe, expect, it } from "vitest";

import {
  clampPeekWidth,
  DRAWER_GAP,
  MIN_TABLE_WIDTH,
  PEEK_MAX_WIDTH,
  PEEK_MIN_WIDTH,
} from "./peek-prefs";

describe("clampPeekWidth", () => {
  it("keeps a comfortable width unchanged", () => {
    expect(clampPeekWidth(600)).toBe(600);
  });

  it("clamps below the minimum up to the minimum", () => {
    expect(clampPeekWidth(100)).toBe(PEEK_MIN_WIDTH);
  });

  it("clamps above the maximum down to the maximum", () => {
    expect(clampPeekWidth(5000)).toBe(PEEK_MAX_WIDTH);
  });

  it("rounds fractional widths", () => {
    expect(clampPeekWidth(600.6)).toBe(601);
  });

  describe("with a container width", () => {
    // The drawer must never squeeze the table below MIN_TABLE_WIDTH.
    it("leaves at least MIN_TABLE_WIDTH for the table", () => {
      expect(clampPeekWidth(900, 1200)).toBe(1200 - MIN_TABLE_WIDTH - DRAWER_GAP);
    });

    it("still honours the absolute maximum on a very wide screen", () => {
      expect(clampPeekWidth(5000, 3000)).toBe(PEEK_MAX_WIDTH);
    });

    // At the lg breakpoint both minimums plus the gap fit exactly:
    // 1024 - 480 - 16 = 528.
    it("allows 528px at the lg breakpoint", () => {
      expect(clampPeekWidth(900, 1024)).toBe(528);
    });

    // Below lg the drawer isn't rendered, but the maths must not return
    // something smaller than the minimum if it is ever called.
    it("never returns less than the minimum, even in an impossible container", () => {
      expect(clampPeekWidth(900, 700)).toBe(PEEK_MIN_WIDTH);
    });
  });
});
