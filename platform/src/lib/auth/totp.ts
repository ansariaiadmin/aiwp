/**
 * RFC 6238 (TOTP) + RFC 4226 (HOTP) implementation using only Node's
 * built-in crypto module — no third-party OTP library dependency, so
 * there is no risk of a breaking API change in an upstream package. This
 * is the same algorithm Google Authenticator / Authy / 1Password use.
 */
import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // allow 1 step of clock drift each direction

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;

  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: string, timeMs: number = Date.now()): string {
  const counter = Math.floor(timeMs / 1000 / PERIOD_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/** Constant-time-ish comparison across a small clock-drift window. */
export function verifyTotp(token: string, secret: string, timeMs: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const counter = Math.floor(timeMs / 1000 / PERIOD_SECONDS);
  const secretBuffer = base32Decode(secret);

  for (let errorWindow = -WINDOW; errorWindow <= WINDOW; errorWindow++) {
    const candidate = hotp(secretBuffer, counter + errorWindow);

    if (timingSafeEqualString(candidate, token)) {
      return true;
    }
  }

  return false;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

/** Builds an otpauth:// URI for QR-code provisioning (Google Authenticator compatible). */
export function buildTotpUri(secret: string, accountEmail: string, issuer = "AiWp Platform"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
