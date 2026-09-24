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

  it("falls back to 127.0.0.1 instead of 'unknown' to avoid global bucket", () => {
    expect(getClientIp(req({}))).toBe("127.0.0.1");
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe("127.0.0.1");
  });

  it("supports cf-connecting-ip and true-client-ip headers", () => {
    expect(getClientIp(req({ "cf-connecting-ip": "203.0.113.10" }))).toBe("203.0.113.10");
    expect(getClientIp(req({ "true-client-ip": "203.0.113.11" }))).toBe("203.0.113.11");
  });

  it("returns different IPs for different X-Forwarded-For values (per-IP buckets)", () => {
    const ip1 = getClientIp(req({ "x-forwarded-for": "1.1.1.1" }));
    const ip2 = getClientIp(req({ "x-forwarded-for": "2.2.2.2" }));
    expect(ip1).toBe("1.1.1.1");
    expect(ip2).toBe("2.2.2.2");
    expect(ip1).not.toBe(ip2);
  });
});
