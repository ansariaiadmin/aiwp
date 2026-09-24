#!/usr/bin/env node
/**
 * Creates (or promotes) the very first SUPER_ADMIN account, so a fresh
 * production deployment always has one way in. Safe to re-run: if the
 * given email already exists it is promoted + activated instead of
 * duplicated.
 *
 * Usage:
 *   node scripts/seed-admin.mjs --email admin@example.com --password 'Str0ng-Pass!' --name "Admin"
 *
 * Reads DATABASE_URL / ENCRYPTION_KEY / SESSION_SECRET from the
 * environment exactly like the app itself (see .env.example).
 */
import postgres from "postgres";
import { argon2id } from "hash-wasm";
import { randomBytes } from "node:crypto";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    out[key] = args[i + 1];
  }
  return out;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 19456,
    hashLength: 32,
    outputType: "encoded",
  });
}

async function main() {
  const { email, password, name } = parseArgs();

  if (!email || !password) {
    console.error("Usage: node scripts/seed-admin.mjs --email <email> --password <password> [--name <name>]");
    process.exit(1);
  }

  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const passwordHash = await hashPassword(password);

  try {
    const existing = await sql`select id from users where email = ${email} limit 1`;

    if (existing.length > 0) {
      await sql`
        update users
        set role = 'SUPER_ADMIN', status = 'ACTIVE', password_hash = ${passwordHash}, email_verified_at = now()
        where id = ${existing[0].id}
      `;
      console.log(`Promoted existing user ${email} to SUPER_ADMIN.`);
    } else {
      await sql`
        insert into users (id, email, name, password_hash, role, status, email_verified_at)
        values (
          ${"usr_" + randomBytes(12).toString("hex")},
          ${email},
          ${name ?? "Administrator"},
          ${passwordHash},
          'SUPER_ADMIN',
          'ACTIVE',
          now()
        )
      `;
      console.log(`Created new SUPER_ADMIN user ${email}.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
