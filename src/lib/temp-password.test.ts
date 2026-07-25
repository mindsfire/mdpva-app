import { describe, expect, it } from "vitest";

import {
  generateTempPassword,
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
} from "./temp-password";

describe("generateTempPassword", () => {
  it("returns a string of the expected length", () => {
    expect(generateTempPassword()).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(TEMP_PASSWORD_LENGTH).toBe(14);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    const password = generateTempPassword();
    for (const char of password) {
      expect(TEMP_PASSWORD_ALPHABET).toContain(char);
    }
  });

  it("excludes visually-confusable characters", () => {
    for (const char of ["0", "O", "1", "l", "I"]) {
      expect(TEMP_PASSWORD_ALPHABET).not.toContain(char);
    }
  });

  it("generates different passwords across calls", () => {
    const passwords = new Set(
      Array.from({ length: 50 }, () => generateTempPassword()),
    );
    // crypto-random 14-char passwords should never collide across 50 calls
    expect(passwords.size).toBe(50);
  });
});
