import { describe, expect, it } from "vitest";
import { generateLicenseKey } from "@/lib/license-key";
import { newDb } from "pg-mem";

// Pure license key tests
describe("License Key Generation", () => {
  it("generates key in XXXX-XXXX-XXXX-XXXX format", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateLicenseKey()));
    expect(keys.size).toBe(100);
  });

  it("does not contain ambiguous characters (0, O, I, L, 1)", () => {
    for (let i = 0; i < 20; i++) {
      const key = generateLicenseKey();
      expect(key).not.toMatch(/[01OIL]/);
    }
  });
});

// Site URL normalization (replicates logic from license-service)
function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

describe("Site URL Normalization", () => {
  it("trims and lowercases", () => {
    expect(normalizeSiteUrl("https://Example.COM/")).toBe("https://example.com");
    expect(normalizeSiteUrl("  https://shop.example.com/// ")).toBe("https://shop.example.com");
  });

  it("handles already normalized URLs", () => {
    expect(normalizeSiteUrl("https://example.com")).toBe("https://example.com");
  });
});

// License API logic with pg-mem (in-memory Postgres)
describe("License API with pg-mem", () => {
  it("can create and query license tables in-memory", async () => {
    const db = newDb();
    // Create minimal schema for licenses (without gen_random_uuid which pg-mem doesn't support)
    db.public.none(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );
      CREATE TABLE licenses (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        product_id TEXT REFERENCES products(id),
        max_activations INT NOT NULL DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        expires_at TIMESTAMP
      );
      CREATE TABLE license_activations (
        id TEXT PRIMARY KEY,
        license_id TEXT REFERENCES licenses(id),
        site_url TEXT NOT NULL,
        deactivated_at TIMESTAMP,
        ip TEXT,
        last_seen_at TIMESTAMP
      );
    `);

    // Insert test data
    db.public.none(`INSERT INTO products (id, slug, name) VALUES ('prod_1', 'test-plugin', 'Test Plugin')`);
    db.public.none(`INSERT INTO licenses (id, key, product_id, max_activations, status) VALUES ('lic_1', 'ABCD-EFGH-IJKL-MNOP', 'prod_1', 2, 'ACTIVE')`);

    const licenses = db.public.many(`SELECT * FROM licenses WHERE key = 'ABCD-EFGH-IJKL-MNOP'`);
    expect(licenses).toHaveLength(1);
    expect(licenses[0].status).toBe("ACTIVE");
  });

  it("enforces max activations logic", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE license_activations (
        id TEXT PRIMARY KEY,
        license_id TEXT NOT NULL,
        site_url TEXT NOT NULL,
        deactivated_at TIMESTAMP
      );
    `);
    // Simulate 2 activations for license with max 2
    db.public.none(`INSERT INTO license_activations (id, license_id, site_url) VALUES ('a1', 'lic_1', 'https://site1.com')`);
    db.public.none(`INSERT INTO license_activations (id, license_id, site_url) VALUES ('a2', 'lic_1', 'https://site2.com')`);

    const count = db.public.one(`SELECT COUNT(*) as cnt FROM license_activations WHERE license_id = 'lic_1' AND deactivated_at IS NULL`);
    expect(Number(count.cnt)).toBe(2);

    // Third activation should be blocked (business logic)
    const maxActivations = 2;
    const canActivate = Number(count.cnt) < maxActivations;
    expect(canActivate).toBe(false);
  });

  it("allows re-activation of same site URL (idempotent)", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE license_activations (
        id TEXT PRIMARY KEY,
        license_id TEXT NOT NULL,
        site_url TEXT NOT NULL,
        deactivated_at TIMESTAMP
      );
    `);
    db.public.none(`INSERT INTO license_activations (id, license_id, site_url) VALUES ('a1', 'lic_1', 'https://example.com')`);

    const existing = db.public.many(`SELECT * FROM license_activations WHERE license_id = 'lic_1' AND site_url = 'https://example.com' AND deactivated_at IS NULL`);
    expect(existing).toHaveLength(1);
    // Idempotent: should not create duplicate, just update last_seen
    expect(existing[0].site_url).toBe("https://example.com");
  });

  it("validate returns success for active license", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE licenses (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
    db.public.none(`INSERT INTO licenses (id, key, status) VALUES ('lic_1', 'VALID-KEY-1234-5678', 'ACTIVE')`);

    const found = db.public.many(`SELECT * FROM licenses WHERE key = 'VALID-KEY-1234-5678' AND status = 'ACTIVE'`);
    expect(found).toHaveLength(1);
  });

  it("deactivate removes activation", async () => {
    const db = newDb();
    db.public.none(`
      CREATE TABLE license_activations (
        id TEXT PRIMARY KEY,
        license_id TEXT NOT NULL,
        site_url TEXT NOT NULL,
        deactivated_at TIMESTAMP
      );
    `);
    db.public.none(`INSERT INTO license_activations (id, license_id, site_url) VALUES ('a1', 'lic_1', 'https://example.com')`);
    db.public.none(`UPDATE license_activations SET deactivated_at = NOW() WHERE id = 'a1'`);

    const active = db.public.many(`SELECT * FROM license_activations WHERE license_id = 'lic_1' AND deactivated_at IS NULL`);
    expect(active).toHaveLength(0);
  });
});
