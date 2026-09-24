/**
 * Password hashing (Argon2id — OWASP-recommended default) and secure
 * random token generation for password resets / email verification.
 *
 * Uses hash-wasm's WebAssembly Argon2 implementation instead of a native
 * addon (e.g. node-argon2): this avoids native compilation entirely, so
 * the same package works identically across every CPU architecture the
 * Docker image might run on, with no rebuild step.
 */
import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes, createHash } from "node:crypto";

const SALT_LENGTH = 16;
const HASH_LENGTH = 32;
const ITERATIONS = 3;
const MEMORY_SIZE_KB = 19456; // ~19 MiB, OWASP 2024 minimum recommendation
const PARALLELISM = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);

  return argon2id({
    password,
    salt,
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_SIZE_KB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    // A malformed/legacy hash must never throw into caller code paths that
    // decide authentication outcomes.
    return false;
  }
}

/**
 * Generates a URL-safe random token plus its SHA-256 hash. Only the hash
 * is ever persisted (password_reset_tokens / email_verification_tokens /
 * api_keys) — the raw token is shown to the user exactly once.
 */
export function generateToken(byteLength = 32): { token: string; tokenHash: string } {
  const token = randomBytes(byteLength).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
