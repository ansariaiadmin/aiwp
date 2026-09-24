import { describe, expect, it } from "vitest";
import { collectTrustedHosts, isSameOriginMutation } from "@/lib/origin";

/**
 * Regression suite for the CSRF origin check.
 *
 * The previous implementation compared the request's Origin against
 * `request.nextUrl.host`. Under the production image's `HOSTNAME=0.0.0.0`
 * that value is literally "0.0.0.0:3000", so every mutating request sent by
 * a real browser was rejected with 403 — login, registration and all admin
 * and customer writes were unreachable in the documented Docker deployment.
 * The cases below pin the corrected, header-based behaviour.
 */
describe("isSameOriginMutation", () => {
  it("allows same-origin mutations behind a reverse proxy", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://shop.example.com",
        forwardedHostHeader: "shop.example.com",
        hostHeader: "app:3000",
      }),
    ).toBe(true);
  });

  it("REGRESSION: allows a legitimate browser Origin when the server listens on 0.0.0.0", () => {
    // Exactly the production Docker shape: HOSTNAME=0.0.0.0, browser talks to
    // the public host, nginx forwards `Host $host` straight through.
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://shop.example.com",
        hostHeader: "shop.example.com",
      }),
    ).toBe(true);
  });

  it("REGRESSION: matches on host+port, not just hostname", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "http://127.0.0.1:3000",
        hostHeader: "127.0.0.1:3000",
      }),
    ).toBe(true);
  });

  it("rejects a cross-site Origin on a mutating request", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://evil.example.net",
        forwardedHostHeader: "shop.example.com",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("rejects a lookalike host that only shares a suffix", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://notshop.example.com",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("rejects a subdomain that is not an address this deployment serves", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://admin.shop.example.com",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("allows a different port only when that port is a trusted host too", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "http://shop.example.com:8443",
        forwardedHostHeader: "shop.example.com:8443, shop.example.com",
        hostHeader: "app:3000",
      }),
    ).toBe(true);

    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "http://shop.example.com:8443",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("is case-insensitive about scheme host and header casing", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "HTTPS://Shop.Example.COM",
        hostHeader: "shop.example.com",
      }),
    ).toBe(true);
  });

  it("always allows non-mutating methods, even cross-origin", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(
        isSameOriginMutation({
          method,
          originHeader: "https://evil.example.net",
          hostHeader: "shop.example.com",
        }),
      ).toBe(true);
    }
  });

  it("treats every mutating verb the same way", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        isSameOriginMutation({
          method,
          originHeader: "https://evil.example.net",
          hostHeader: "shop.example.com",
        }),
      ).toBe(false);
    }
  });

  it("accepts a lowercase method value", () => {
    expect(
      isSameOriginMutation({
        method: "post",
        originHeader: "https://evil.example.net",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("allows a missing or blank Origin (SameSite cookie still applies)", () => {
    expect(
      isSameOriginMutation({ method: "POST", originHeader: null, hostHeader: "shop.example.com" }),
    ).toBe(true);
    expect(
      isSameOriginMutation({ method: "POST", originHeader: "   ", hostHeader: "shop.example.com" }),
    ).toBe(true);
  });

  it("fails closed on an Origin header that cannot be parsed", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "not a url at all",
        hostHeader: "shop.example.com",
      }),
    ).toBe(false);
  });

  it("fails closed when no trusted host can be determined", () => {
    expect(
      isSameOriginMutation({
        method: "POST",
        originHeader: "https://shop.example.com",
        forwardedHostHeader: null,
        hostHeader: null,
      }),
    ).toBe(false);
  });
});

describe("collectTrustedHosts", () => {
  it("collects every X-Forwarded-Host entry plus the Host header", () => {
    const hosts = collectTrustedHosts({
      method: "GET",
      originHeader: null,
      forwardedHostHeader: "shop.example.com, cache.example.com",
      hostHeader: "app:3000",
    });

    expect([...hosts].sort()).toEqual(["app:3000", "cache.example.com", "shop.example.com"]);
  });

  it("accepts full URLs as well as bare authorities", () => {
    const hosts = collectTrustedHosts({
      method: "GET",
      originHeader: null,
      forwardedHostHeader: "https://shop.example.com",
      hostHeader: "127.0.0.1:3000",
    });

    expect(hosts.has("shop.example.com")).toBe(true);
    expect(hosts.has("127.0.0.1:3000")).toBe(true);
  });

  it("ignores unparseable entries instead of throwing", () => {
    const hosts = collectTrustedHosts({
      method: "GET",
      originHeader: null,
      forwardedHostHeader: "shop.example.com, /broken/path,   ",
      hostHeader: "app:3000",
    });

    expect([...hosts].sort()).toEqual(["app:3000", "shop.example.com"]);
  });

  it("returns an empty set when nothing is usable", () => {
    const hosts = collectTrustedHosts({
      method: "GET",
      originHeader: null,
      forwardedHostHeader: null,
      hostHeader: null,
    });

    expect(hosts.size).toBe(0);
  });
});
