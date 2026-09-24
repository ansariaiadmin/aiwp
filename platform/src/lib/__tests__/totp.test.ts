import { describe, expect, it } from "vitest";
import { buildTotpUri, generateTotp, generateTotpSecret, verifyTotp } from "@/lib/auth/totp";

/**
 * RFC 4226 §D test vector secret: the ASCII string "12345678901234567890",
 * base32-encoded. The implementation uses HMAC-SHA1, 6 digits and a 30s
 * period, so the published HOTP table applies directly with
 * counter = floor(timeMs / 1000 / 30).
 */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/** RFC 4226 Appendix D — HOTP values for counters 0..9. */
const RFC_HOTP = [
  "755224",
  "287082",
  "359152",
  "969429",
  "338314",
  "254676",
  "287922",
  "162583",
  "399871",
  "520489",
] as const;

const STEP_MS = 30_000;

describe("generateTotp — RFC 4226 Appendix D vectors", () => {
  it.each(RFC_HOTP.map((code, counter) => ({ counter, code })))(
    "counter $counter -> $code",
    ({ counter, code }) => {
      expect(generateTotp(RFC_SECRET, counter * STEP_MS)).toBe(code);
    },
  );

  it("is stable for every instant inside a 30-second step", () => {
    expect(generateTotp(RFC_SECRET, 0)).toBe("755224");
    expect(generateTotp(RFC_SECRET, 15_000)).toBe("755224");
    expect(generateTotp(RFC_SECRET, 29_999)).toBe("755224");
    expect(generateTotp(RFC_SECRET, 30_000)).toBe("287082");
  });
});

describe("verifyTotp", () => {
  it("accepts the code for the current step", () => {
    expect(verifyTotp("287082", RFC_SECRET, 1 * STEP_MS)).toBe(true);
  });

  it("accepts one step of clock drift in either direction", () => {
    // Counter 1 at this instant; window is ±1, so counters 0, 1 and 2 pass.
    expect(verifyTotp("755224", RFC_SECRET, 1 * STEP_MS)).toBe(true); // counter 0
    expect(verifyTotp("359152", RFC_SECRET, 1 * STEP_MS)).toBe(true); // counter 2
  });

  it("rejects codes outside the drift window", () => {
    expect(verifyTotp("969429", RFC_SECRET, 1 * STEP_MS)).toBe(false); // counter 3
    expect(verifyTotp("755224", RFC_SECRET, 5 * STEP_MS)).toBe(false); // 4 steps stale
  });

  it("rejects a wrong code and a wrong secret", () => {
    expect(verifyTotp("000000", RFC_SECRET, 1 * STEP_MS)).toBe(false);
    expect(verifyTotp("287082", generateTotpSecret(), 1 * STEP_MS)).toBe(false);
  });

  it("rejects anything that is not exactly six digits", () => {
    for (const token of ["", "28708", "2870821", "abcdef", "28708 ", "-28708"]) {
      expect(verifyTotp(token, RFC_SECRET, 1 * STEP_MS)).toBe(false);
    }
  });
});

describe("generateTotpSecret", () => {
  it("produces a 32-character base32 secret (160 bits) and varies between calls", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();

    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(b).toMatch(/^[A-Z2-7]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("buildTotpUri", () => {
  it("builds a Google Authenticator compatible otpauth URI", () => {
    const uri = buildTotpUri(RFC_SECRET, "admin@example.com");

    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(encodeURIComponent("AiWp Platform:admin@example.com"));
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("honours a custom issuer", () => {
    expect(buildTotpUri(RFC_SECRET, "a@b.test", "Acme")).toContain("issuer=Acme");
  });
});
