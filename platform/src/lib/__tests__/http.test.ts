import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/http";

function req(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1:3000/api/auth/login", { method: "POST", headers });
}

/**
 * Pins the client-IP resolution used for rate limiting and audit logging.
 * nginx/conf.d/proxy-common.inc sets `X-Real-IP $remote_addr` and appends to
 * X-Forwarded-For, so X-Real-IP is authoritative and the *last* XFF hop is
 * the one our own trusted proxy added (the first hop is attacker-controlled).
 */
describe("getClientIp", () => {
  it("prefers X-Real-IP over X-Forwarded-For", () => {
    expect(getClientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.9" }))).toBe(
      "203.0.113.5",
    );
  });

  it("trims whitespace around X-Real-IP", () => {
    expect(getClientIp(req({ "x-real-ip": "  203.0.113.5  " }))).toBe("203.0.113.5");
  });

  it("takes the last X-Forwarded-For hop, never the client-supplied first one", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.5" }))).toBe(
      "203.0.113.5",
    );
  });

  it("handles a single-entry X-Forwarded-For", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
  });

  /**
   * Known limitation, asserted here so it stays visible: with no proxy in
   * front, every direct client collapses into one shared "unknown" bucket.
   * loginLimiter keys on `${ip}:${email}` so this is mostly harmless, but
   * registerLimiter keys on the IP alone — see docs/AUDIT-2026-09-07.md §3.6.
   */
  it("falls back to the literal string 'unknown' with no proxy headers", () => {
    expect(getClientIp(req({}))).toBe("unknown");
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});
