import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isTurnstileConfigured, verifyTurnstile } from "./turnstile";

const SECRET = "TURNSTILE_SECRET_KEY";

function mockFetch(impl: () => Promise<unknown> | never) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    delete process.env[SECRET];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env[SECRET];
  });

  describe("when unconfigured", () => {
    it("skips the check so the flow keeps working", () => {
      expect(isTurnstileConfigured()).toBe(false);
    });

    it("passes without calling Cloudflare at all", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await expect(verifyTurnstile(null)).resolves.toEqual({
        ok: true,
        skipped: true,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when configured", () => {
    beforeEach(() => {
      process.env[SECRET] = "secret";
    });

    it("reports configured", () => {
      expect(isTurnstileConfigured()).toBe(true);
    });

    it("rejects a missing token without a network call", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await expect(verifyTurnstile(null)).resolves.toEqual({
        ok: false,
        skipped: false,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("passes when Cloudflare returns success", async () => {
      mockFetch(async () => ({ json: async () => ({ success: true }) }));
      await expect(verifyTurnstile("tok")).resolves.toEqual({
        ok: true,
        skipped: false,
      });
    });

    it("fails when Cloudflare rejects the token", async () => {
      mockFetch(async () => ({
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      }));
      await expect(verifyTurnstile("tok")).resolves.toEqual({
        ok: false,
        skipped: false,
      });
    });

    it("fails closed when Cloudflare is unreachable", async () => {
      // The important one: an attacker who can make this request fail would
      // otherwise bypass the check entirely.
      mockFetch(async () => {
        throw new Error("network down");
      });
      await expect(verifyTurnstile("tok")).resolves.toEqual({
        ok: false,
        skipped: false,
      });
    });

    it("fails closed on a malformed response", async () => {
      mockFetch(async () => ({
        json: async () => {
          throw new Error("not json");
        },
      }));
      await expect(verifyTurnstile("tok")).resolves.toEqual({
        ok: false,
        skipped: false,
      });
    });

    it("sends the secret and token, and omits a placeholder IP", async () => {
      const fetchSpy =
        vi.fn<(url: string, init: { body: URLSearchParams }) => Promise<unknown>>(
          async () => ({ json: async () => ({ success: true }) }),
        );
      vi.stubGlobal("fetch", fetchSpy);

      await verifyTurnstile("tok", "unknown");
      const body = fetchSpy.mock.calls[0]![1].body;
      expect(body.get("secret")).toBe("secret");
      expect(body.get("response")).toBe("tok");
      // "unknown" is our placeholder, not an address — sending it would make
      // Cloudflare reject an otherwise valid check.
      expect(body.get("remoteip")).toBeNull();
    });

    it("forwards a real client IP", async () => {
      const fetchSpy =
        vi.fn<(url: string, init: { body: URLSearchParams }) => Promise<unknown>>(
          async () => ({ json: async () => ({ success: true }) }),
        );
      vi.stubGlobal("fetch", fetchSpy);

      await verifyTurnstile("tok", "49.207.1.1");
      const body = fetchSpy.mock.calls[0]![1].body;
      expect(body.get("remoteip")).toBe("49.207.1.1");
    });
  });
});
