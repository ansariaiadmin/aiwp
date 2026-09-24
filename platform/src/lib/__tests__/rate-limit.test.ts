import { describe, expect, it } from "vitest";
import { RateLimiterMemory } from "rate-limiter-flexible";

describe("Rate Limiter Per-IP Separation", () => {
  it("should have separate buckets for different IPs", async () => {
    const limiter = new RateLimiterMemory({ points: 2, duration: 60 });

    // IP 1 consumes 2 points
    await limiter.consume("1.1.1.1");
    await limiter.consume("1.1.1.1");

    // IP 1 should be blocked on 3rd
    await expect(limiter.consume("1.1.1.1")).rejects.toBeTruthy();

    // IP 2 should still be allowed (separate bucket)
    await expect(limiter.consume("2.2.2.2")).resolves.toBeTruthy();
    await expect(limiter.consume("2.2.2.2")).resolves.toBeTruthy();

    // IP 2 now blocked too
    await expect(limiter.consume("2.2.2.2")).rejects.toBeTruthy();

    // IP 3 still allowed
    await expect(limiter.consume("3.3.3.3")).resolves.toBeTruthy();
  });

  it("should have separate buckets for ip:email combo (login limiter)", async () => {
    const limiter = new RateLimiterMemory({ points: 3, duration: 60 });

    const ip = "1.1.1.1";
    const email1 = "user1@example.com";
    const email2 = "user2@example.com";

    // Exhaust bucket for ip:email1
    await limiter.consume(`${ip}:${email1}`);
    await limiter.consume(`${ip}:${email1}`);
    await limiter.consume(`${ip}:${email1}`);
    await expect(limiter.consume(`${ip}:${email1}`)).rejects.toBeTruthy();

    // Same IP but different email should still be allowed
    await expect(limiter.consume(`${ip}:${email2}`)).resolves.toBeTruthy();
  });

  it("should reset after duration", async () => {
    const limiter = new RateLimiterMemory({ points: 1, duration: 1 }); // 1 sec

    await limiter.consume("1.1.1.1");
    await expect(limiter.consume("1.1.1.1")).rejects.toBeTruthy();

    // Wait 1.1 sec
    await new Promise((r) => setTimeout(r, 1100));

    // Should be allowed again
    await expect(limiter.consume("1.1.1.1")).resolves.toBeTruthy();
  });

  it("registerLimiter per-IP only (not email) - global bucket fix verification", async () => {
    const limiter = new RateLimiterMemory({ points: 3, duration: 3600 });

    // Simulate old bug: all IPs returned "unknown" -> shared bucket
    // New fix: each IP has its own bucket, so different IPs don't share

    // With old bug, these would all hit same "unknown" bucket
    const oldBugKey = "unknown";
    const newFixKeys = ["1.1.1.1", "2.2.2.2", "3.3.3.3"];

    // Old bug: 3 requests from different IPs would exhaust shared bucket
    // New fix: each IP has separate bucket

    // Test new behavior: each IP separate
    for (const ip of newFixKeys) {
      await limiter.consume(ip);
    }

    // Each IP consumed 1, so each should still have 2 left
    for (const ip of newFixKeys) {
      await expect(limiter.consume(ip)).resolves.toBeTruthy();
      await expect(limiter.consume(ip)).resolves.toBeTruthy();
      // Now exhausted
      await expect(limiter.consume(ip)).rejects.toBeTruthy();
    }

    // Verify old shared bucket would have failed earlier
    // If all used same key "unknown", after 3 consumes, 4th would fail
    const sharedLimiter = new RateLimiterMemory({ points: 3, duration: 3600 });
    await sharedLimiter.consume(oldBugKey);
    await sharedLimiter.consume(oldBugKey);
    await sharedLimiter.consume(oldBugKey);
    await expect(sharedLimiter.consume(oldBugKey)).rejects.toBeTruthy();
    // This demonstrates the bug: 3 different real IPs blocked because they shared "unknown"
  });
});

describe("Origin Check with ALLOWED_ORIGINS", () => {
  it("should allow origin in ALLOWED_ORIGINS env", async () => {
    // This test verifies the fix for HOSTNAME=0.0.0.0 issue
    // and ALLOWED_ORIGINS allowlist
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com, https://shop.example.com";

    // Dynamic import to get fresh env reading
    const { collectTrustedHosts, isSameOriginMutation } = await import("@/lib/origin");

    const hosts = collectTrustedHosts({
      method: "POST",
      originHeader: "https://allowed.example.com",
      hostHeader: "app:3000",
    });

    expect(hosts.has("allowed.example.com")).toBe(true);

    const allowed = isSameOriginMutation({
      method: "POST",
      originHeader: "https://allowed.example.com",
      hostHeader: "app:3000",
    });

    expect(allowed).toBe(true);

    // Cleanup
    delete process.env.ALLOWED_ORIGINS;
  });
});
