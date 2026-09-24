/**
 * Encryption-at-rest helpers for sensitive platform settings (AI provider
 * API keys, SMS gateway credentials). Uses AES-256-GCM (authenticated
 * encryption) with a per-value random IV. The master key comes only from
 * the ENCRYPTION_KEY environment variable — never hardcoded, never
 * committed. Losing this key makes existing encrypted settings
 * unrecoverable by design (there is no backdoor).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const SALT = "aiwp-platform-static-salt-v1"; // non-secret; only spreads key derivation cost

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret || secret.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is missing or too short. Set a random 32+ character secret in your environment before storing any platform setting.",
    );
  }

  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypts a plaintext string. Output format: base64(iv):base64(authTag):base64(ciphertext).
 */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    ":",
  );
}

/**
 * Decrypts a value produced by encryptSecret(). Throws if the ciphertext
 * was tampered with (GCM authentication failure) or the key is wrong.
 */
export function decryptSecret(payload: string): string {
  const key = getMasterKey();
  const parts = payload.split(":");

  // Exactly three base64 segments are required. The ciphertext segment may
  // legitimately be empty — encrypting the empty string yields zero-length
  // ciphertext — so only the IV and the auth tag must be non-empty. Both
  // current callers (setAiProviderConfig / setSmsGatewayConfig) skip empty
  // values, so this was unreachable until now, but a future caller passing
  // "" would otherwise get an unrecoverable row instead of a round-trip.
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted payload.");
  }

  const [ivB64, authTagB64, dataB64] = parts;

  if (!ivB64 || !authTagB64) {
    throw new Error("Malformed encrypted payload.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Masks a secret for display in the UI (e.g. "sk-ab12************3f9c"),
 * so admins can confirm which key is set without ever re-displaying it.
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "*".repeat(secret.length);
  }

  return `${secret.slice(0, 4)}${"*".repeat(Math.max(4, secret.length - 8))}${secret.slice(-4)}`;
}
