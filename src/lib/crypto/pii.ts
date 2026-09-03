import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";

/**
 * Field-level encryption for values too sensitive to store as plaintext
 * (Aadhaar), unlike the rest of the schema's PII (phone, email, DOB), which
 * this app stores unencrypted. This is a self-contained capability — nothing
 * upstream to reuse.
 *
 * `encryptPii`/`decryptPii` use AES-256-GCM: authenticated, so a tampered or
 * truncated ciphertext throws instead of silently decrypting to garbage.
 * GCM's IV is random per call, which means the same plaintext never produces
 * the same ciphertext twice — so a DB unique index cannot be built on it.
 * `blindIndex` exists for that: a deterministic HMAC, keyed separately from
 * the encryption key, used only for equality lookups and the unique
 * constraint. Two different keys mean a leak of one doesn't compromise the
 * other's guarantee.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function readKey(envVar: string): Buffer {
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(
      `${envVar} is not set. Generate one with: openssl rand -base64 32`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${envVar} must decode to ${KEY_BYTES} bytes (base64)`);
  }
  return key;
}

// Read lazily (not at module load) so a missing key only breaks the code path
// that actually needs it, matching how other env-gated features in this repo
// behave (e.g. TURNSTILE_SECRET_KEY).
function encKey(): Buffer {
  return readKey("AADHAAR_ENC_KEY");
}

function hashKey(): Buffer {
  return readKey("AADHAAR_HASH_KEY");
}

/** `base64(iv | authTag | ciphertext)`. */
export function encryptPii(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Inverse of `encryptPii`. Throws if the payload was tampered with or truncated. */
export function decryptPii(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + 16);
  const ciphertext = buf.subarray(IV_BYTES + 16);

  const decipher = createDecipheriv(ALGORITHM, encKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Deterministic HMAC-SHA256 of a normalized value, for equality lookups and
 * the unique index — never for anything an attacker could use to enumerate
 * values, since the key is a secret.
 */
export function blindIndex(normalized: string): string {
  return createHmac("sha256", hashKey()).update(normalized).digest("hex");
}
