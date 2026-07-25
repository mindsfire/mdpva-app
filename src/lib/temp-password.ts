import { randomInt } from "crypto";

/**
 * Unambiguous alphabet: excludes visually-confusable characters
 * (0/O, 1/l/I) so a temp password can be read aloud/typed without mistakes.
 */
export const TEMP_PASSWORD_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

export const TEMP_PASSWORD_LENGTH = 14;

/**
 * Crypto-random 14-char temp password drawn from an unambiguous alphabet.
 * Used for admin-created accounts and password resets — shown once to the
 * admin, never persisted in plaintext.
 */
export function generateTempPassword(): string {
  let password = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    const index = randomInt(TEMP_PASSWORD_ALPHABET.length);
    password += TEMP_PASSWORD_ALPHABET[index];
  }
  return password;
}
