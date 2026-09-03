import { randomBytes } from "crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { blindIndex, decryptPii, encryptPii } from "./pii";

beforeAll(() => {
  process.env.AADHAAR_ENC_KEY = randomBytes(32).toString("base64");
  process.env.AADHAAR_HASH_KEY = randomBytes(32).toString("base64");
});

describe("encryptPii / decryptPii", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "234567890124";
    const ciphertext = encryptPii(plaintext);
    expect(decryptPii(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext across calls", () => {
    const plaintext = "234567890124";
    const a = encryptPii(plaintext);
    const b = encryptPii(plaintext);
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe(plaintext);
    expect(decryptPii(b)).toBe(plaintext);
  });

  it("throws when the ciphertext is tampered with", () => {
    const ciphertext = encryptPii("234567890124");
    const buf = Buffer.from(ciphertext, "base64");
    // Flip a byte inside the ciphertext region, invalidating the auth tag.
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptPii(tampered)).toThrow();
  });

  it("throws when the payload is truncated", () => {
    const ciphertext = encryptPii("234567890124");
    const truncated = ciphertext.slice(0, 10);
    expect(() => decryptPii(truncated)).toThrow();
  });
});

describe("blindIndex", () => {
  it("is deterministic for the same input", () => {
    expect(blindIndex("234567890124")).toBe(blindIndex("234567890124"));
  });

  it("differs for different inputs", () => {
    expect(blindIndex("234567890124")).not.toBe(blindIndex("876543210988"));
  });

  it("does not reveal the input in its output", () => {
    expect(blindIndex("234567890124")).not.toContain("234567890124");
  });
});
