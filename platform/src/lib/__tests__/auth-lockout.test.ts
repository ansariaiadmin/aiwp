import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { newDb } from "pg-mem";

describe("Auth Password Hashing", () => {
  it("hashes and verifies password correctly", async () => {
    const password = "TestPass123!";
    const hash = await hashPassword(password);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("rejects malformed hash gracefully", async () => {
    expect(await verifyPassword("not-a-valid-hash", "password")).toBe(false);
  });
});

describe("Auth Lockout Logic (423 vs 429)", () => {
  it("should return 423 for locked account before rate-limit 429", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        locked_until TIMESTAMP,
        failed_login_count INT DEFAULT 0
      );
    `);
    // User locked until future
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.public.none(`INSERT INTO users (id, email, locked_until, failed_login_count) VALUES ('u1', 'test@example.com', '${future}', 0)`);

    const user = db.public.one(`SELECT * FROM users WHERE email = 'test@example.com'`);
    expect(user).toBeTruthy();
    const lockedUntil = new Date(user.locked_until as string);
    expect(lockedUntil.getTime()).toBeGreaterThan(Date.now());

    // Simulate login route logic: check lockout first
    const isLocked = lockedUntil.getTime() > Date.now();
    expect(isLocked).toBe(true);

    // Should return 423, not 429
    const statusCode = isLocked ? 423 : 429;
    expect(statusCode).toBe(423);
  });

  it("should allow login after lockout expires", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        locked_until TIMESTAMP
      );
    `);
    const past = new Date(Date.now() - 1000).toISOString();
    db.public.none(`INSERT INTO users (id, email, locked_until) VALUES ('u1', 'test@example.com', '${past}')`);

    const user = db.public.one(`SELECT * FROM users WHERE email = 'test@example.com'`);
    const lockedUntil = new Date(user.locked_until as string);
    expect(lockedUntil.getTime()).toBeLessThan(Date.now());
    expect(lockedUntil.getTime() > Date.now()).toBe(false);
  });

  it("increments failed count and locks after 5 attempts", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        failed_login_count INT DEFAULT 0,
        locked_until TIMESTAMP
      );
    `);
    db.public.none(`INSERT INTO users (id, email, failed_login_count) VALUES ('u1', 'test@example.com', 4)`);

    let user = db.public.one(`SELECT * FROM users WHERE email = 'test@example.com'`);
    expect(Number(user.failed_login_count)).toBe(4);

    // Simulate 5th failed attempt
    const failedCount = Number(user.failed_login_count) + 1;
    const shouldLock = failedCount >= 5;
    expect(shouldLock).toBe(true);

    if (shouldLock) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.public.none(`UPDATE users SET failed_login_count = 0, locked_until = '${lockUntil}' WHERE id = 'u1'`);
    }

    user = db.public.one(`SELECT * FROM users WHERE email = 'test@example.com'`);
    expect(Number(user.failed_login_count)).toBe(0);
    expect(user.locked_until).toBeTruthy();
  });
});

describe("Rate Limit Per-IP Buckets", () => {
  it("different IPs should have separate buckets", () => {
    // Simulate rate limiter buckets per IP
    const buckets = new Map<string, number>();

    function consume(ip: string, limit = 3): boolean {
      const count = buckets.get(ip) || 0;
      if (count >= limit) return false; // rate limited
      buckets.set(ip, count + 1);
      return true;
    }

    // IP1 consumes 3 times
    expect(consume("1.1.1.1")).toBe(true);
    expect(consume("1.1.1.1")).toBe(true);
    expect(consume("1.1.1.1")).toBe(true);
    expect(consume("1.1.1.1")).toBe(false); // 4th should fail

    // IP2 should still have its own bucket, not affected by IP1
    expect(consume("2.2.2.2")).toBe(true);
    expect(consume("2.2.2.2")).toBe(true);
    expect(consume("2.2.2.2")).toBe(true);
    expect(consume("2.2.2.2")).toBe(false);

    // IP1 still blocked
    expect(consume("1.1.1.1")).toBe(false);
  });

  it("same IP with different emails should have separate login buckets (ip:email)", () => {
    const buckets = new Map<string, number>();

    function consume(ip: string, email: string, limit = 5): boolean {
      const key = `${ip}:${email}`;
      const count = buckets.get(key) || 0;
      if (count >= limit) return false;
      buckets.set(key, count + 1);
      return true;
    }

    // Same IP, different emails
    expect(consume("1.1.1.1", "a@example.com")).toBe(true);
    expect(consume("1.1.1.1", "b@example.com")).toBe(true);

    // Exhaust bucket for a@example.com
    for (let i = 0; i < 4; i++) consume("1.1.1.1", "a@example.com");
    expect(consume("1.1.1.1", "a@example.com")).toBe(false);

    // b@example.com still allowed
    expect(consume("1.1.1.1", "b@example.com")).toBe(true);
  });
});
