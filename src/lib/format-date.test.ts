import { describe, expect, it } from "vitest";

import { formatDateIST, formatDateTimeIST } from "./format-date";

describe("formatDateTimeIST", () => {
  // IST is UTC+5:30, so 2026-09-25T20:00:00Z (8pm UTC) is already the next
  // calendar day in India — this is exactly the boundary case that broke
  // without an explicit time zone.
  it("renders a late-UTC timestamp as the next IST day, with the time", () => {
    const date = new Date("2026-09-25T20:00:00Z");
    expect(formatDateTimeIST(date)).toBe("26 Sept 2026, 1:30 am IST");
  });
});

describe("formatDateIST", () => {
  it("renders the IST calendar day, not the UTC one", () => {
    const date = new Date("2026-09-25T20:00:00Z");
    expect(formatDateIST(date)).toBe("26 Sept 2026");
  });

  it("keeps the UTC day when IST doesn't roll it over", () => {
    const date = new Date("2026-09-25T10:00:00Z");
    expect(formatDateIST(date)).toBe("25 Sept 2026");
  });
});
