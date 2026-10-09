import { describe, expect, it } from "vitest";

import { SIGNED_URL_TTL_SECONDS, signingWindow } from "./photo-signing";

const DAY_START = Date.parse("2026-10-09T00:00:00Z");
const MORNING = DAY_START + 3 * 60 * 60 * 1000; // 03:00 UTC
const EVENING = DAY_START + 20 * 60 * 60 * 1000; // 20:00 UTC

describe("signingWindow", () => {
  it("signs every request in the same day identically, so the URL is cacheable", () => {
    expect(signingWindow(null, MORNING).signingDate).toEqual(new Date(DAY_START));
    expect(signingWindow(null, EVENING).signingDate).toEqual(new Date(DAY_START));
  });

  it("uses a version from earlier days as no different from no version", () => {
    const lastWeek = String(DAY_START - 7 * 24 * 60 * 60 * 1000);
    expect(signingWindow(lastWeek, MORNING).signingDate).toEqual(new Date(DAY_START));
  });

  it("signs at the version when the photo changed today, giving a fresh URL", () => {
    const changedAt = DAY_START + 2 * 60 * 60 * 1000 + 123;
    const signed = signingWindow(String(changedAt), EVENING).signingDate;
    expect(signed.getTime()).toBe(changedAt - 123); // truncated to the second
    expect(signed).not.toEqual(signingWindow(null, EVENING).signingDate);
  });

  it("clamps a future version to now, so R2 never gets a future signing time", () => {
    const future = String(EVENING + 60 * 60 * 1000);
    expect(signingWindow(future, MORNING).signingDate.getTime()).toBe(MORNING);
  });

  it("ignores a version that isn't a timestamp", () => {
    expect(signingWindow("abc", MORNING).signingDate).toEqual(new Date(DAY_START));
    expect(signingWindow("", MORNING).signingDate).toEqual(new Date(DAY_START));
  });

  it("caches the redirect only until the end of the day", () => {
    expect(signingWindow(null, MORNING).redirectMaxAgeSeconds).toBe(21 * 60 * 60);
    expect(signingWindow(null, EVENING).redirectMaxAgeSeconds).toBe(4 * 60 * 60);
  });

  it("never lets a cached redirect outlive the link it points at", () => {
    for (const now of [DAY_START, MORNING, EVENING, DAY_START + 86_399_000]) {
      const { signingDate, redirectMaxAgeSeconds } = signingWindow(null, now);
      const linkExpires = signingDate.getTime() + SIGNED_URL_TTL_SECONDS * 1000;
      expect(now + redirectMaxAgeSeconds * 1000).toBeLessThan(linkExpires);
    }
  });
});
