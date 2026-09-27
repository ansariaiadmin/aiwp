import { afterEach, describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/http";

function req(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1:3000/api/auth/login", { method: "POST", headers });
}

const TRUST_PROXY_KEY = "TRUST_PROXY";

function withTrustProxy(value: string | undefined, fn: () => void): void {
  const previous = process.env[TRUST_PROXY_KEY];
  if (value === undefined) delete process.env[TRUST_PROXY_KEY];
  else process.env[TRUST_PROXY_KEY] = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env[TRUST_PROXY_KEY];
    else process.env[TRUST_PROXY_KEY] = previous;
  }
}

afterEach(() => {
  delete process.env[TRUST_PROXY_KEY];
});

/**
 * Pins the client-IP resolution used for rate limiting and audit logging.
 *
 * SECURITY MODEL (see src/lib/http.ts):
 * - Default (no TRUST_PROXY): every IP-carrying header is attacker-forgable
 *   because the app is directly reachable (the documented compose deployment
 *   exposes port 3000). So only the *last* X-Forwarded-For hop — which a
 *   trusted proxy appends from its real socket peer — is used, and the
 *   fallback is 127.0.0.1 (one shared bucket, never "unknown").
 * - TRUST_PROXY=true: a trusted L7 proxy is in front and sets these from the
 *   real peer, so X-Real-IP / cf-connecting-ip / true-client-ip / x-client-ip
 *   are honoured, and the *first* XFF entry (the originating client) is used.
 */
describe("getClientIp — default (no TRUST_PROXY): headers are untrusted", () => {
  it("ignores a client-forged X-Real-IP instead of letting it swap the rate-limit bucket", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({ "x-real-ip": "203.0.113.5" }))).toBe("127.0.0.1");
    });
  });

  it("ignores a forged X-Real-IP even when an XFF chain is present (last hop wins)", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.9" }))).toBe(
        "198.51.100.9",
      );
    });
  });

  it("ignores forged cf-connecting-ip / true-client-ip / x-client-ip", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({ "cf-connecting-ip": "203.0.113.10" }))).toBe("127.0.0.1");
      expect(getClientIp(req({ "true-client-ip": "203.0.113.11" }))).toBe("127.0.0.1");
      expect(getClientIp(req({ "x-client-ip": "203.0.113.12" }))).toBe("127.0.0.1");
    });
  });

  it("takes the last X-Forwarded-For hop, never the client-supplied first one", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.5" }))).toBe(
        "203.0.113.5",
      );
    });
  });

  it("handles a single-entry X-Forwarded-For", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
    });
  });

  it("falls back to 127.0.0.1 instead of 'unknown' to avoid a global bucket", () => {
    withTrustProxy(undefined, () => {
      expect(getClientIp(req({}))).toBe("127.0.0.1");
      expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe("127.0.0.1");
    });
  });

  it("returns different IPs for different X-Forwarded-For values (per-IP buckets)", () => {
    withTrustProxy(undefined, () => {
      const ip1 = getClientIp(req({ "x-forwarded-for": "1.1.1.1" }));
      const ip2 = getClientIp(req({ "x-forwarded-for": "2.2.2.2" }));
      expect(ip1).toBe("1.1.1.1");
      expect(ip2).toBe("2.2.2.2");
      expect(ip1).not.toBe(ip2);
    });
  });
});

describe("getClientIp — TRUST_PROXY=true: trusted proxy headers are honoured", () => {
  it("prefers X-Real-IP over X-Forwarded-For", () => {
    withTrustProxy("true", () => {
      expect(getClientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.9" }))).toBe(
        "203.0.113.5",
      );
    });
  });

  it("trims whitespace around X-Real-IP", () => {
    withTrustProxy("true", () => {
      expect(getClientIp(req({ "x-real-ip": "  203.0.113.5  " }))).toBe("203.0.113.5");
    });
  });

  it("supports cf-connecting-ip and true-client-ip headers", () => {
    withTrustProxy("true", () => {
      expect(getClientIp(req({ "cf-connecting-ip": "203.0.113.10" }))).toBe("203.0.113.10");
      expect(getClientIp(req({ "true-client-ip": "203.0.113.11" }))).toBe("203.0.113.11");
    });
  });

  it("uses the first (originating) X-Forwarded-For entry when behind a proxy", () => {
    withTrustProxy("true", () => {
      expect(getClientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.5" }))).toBe("1.1.1.1");
    });
  });

  it("honours TRUST_PROXY=1 as well", () => {
    withTrustProxy("1", () => {
      expect(getClientIp(req({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    });
  });
});
