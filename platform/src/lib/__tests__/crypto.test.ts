import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

const KEY = "unit-test-encryption-key-0123456789";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * AES-256-GCM encryption-at-rest for platform settings (AI provider API
 * keys, SMS gateway credentials). These tests assert the properties that
 * make it safe to store secrets in a shared database: reversibility with
 * the right key, authenticated rejection of tampering, and non-determinism
 * (a fresh IV per value, so identical secrets do not produce identical
 * ciphertext).
 */
describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    const plaintext = "sk-SUPER-SECRET-9999";
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it("round-trips unicode and empty strings", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    expect(decryptSecret(encryptSecret("رمز-عبور-فارسی"))).toBe("رمز-عبور-فارسی");
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("produces the documented base64(iv):base64(tag):base64(data) format", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    const parts = encryptSecret("hello").split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
    // 96-bit nonce, as recommended for GCM.
    expect(Buffer.from(parts[0], "base64")).toHaveLength(12);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(16);
  });

  it("never emits the plaintext, and is non-deterministic", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    const plaintext = "sk-SUPER-SECRET-9999";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);

    expect(a).not.toContain(plaintext);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  it("rejects ciphertext whose payload was tampered with", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    const [iv, tag, data] = encryptSecret("sk-SUPER-SECRET-9999").split(":");
    const payload = Buffer.from(data, "base64");
    payload[0] ^= 0xff;

    expect(() => decryptSecret([iv, tag, payload.toString("base64")].join(":"))).toThrow();
  });

  it("rejects a payload produced under a different key", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const payload = encryptSecret("sk-SUPER-SECRET-9999");

    vi.stubEnv("ENCRYPTION_KEY", "a-completely-different-key-9876543210");
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("rejects a malformed payload", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);

    expect(() => decryptSecret("nonsense")).toThrow("Malformed encrypted payload.");
    expect(() => decryptSecret("a:b")).toThrow("Malformed encrypted payload.");
  });

  it("refuses to run without a usable ENCRYPTION_KEY", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);

    vi.stubEnv("ENCRYPTION_KEY", "too-short");
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });
});

describe("maskSecret", () => {
  it("keeps only a 4-character prefix and suffix for long secrets", () => {
    // These two are the exact strings the running API returned in
    // GET /api/admin/settings/{ai-provider,sms-gateway}.
    expect(maskSecret("sk-SUPER-SECRET-9999")).toBe("sk-S************9999");
    expect(maskSecret("KV-SECRET-12345")).toBe("KV-S*******2345");
  });

  it("fully masks anything 8 characters or shorter", () => {
    expect(maskSecret("abcd")).toBe("****");
    expect(maskSecret("abcdefgh")).toBe("********");
  });

  it("never leaks the middle of a secret", () => {
    const masked = maskSecret("sk-SUPER-SECRET-9999");
    expect(masked).not.toContain("SUPER");
    expect(masked).not.toContain("SECRET");
  });
});
