#!/usr/bin/env node
/**
 * Lightweight production migration runner: applies every .sql file in
 * drizzle/ (in filename order) inside a single transaction each, tracked
 * in a `__drizzle_migrations` table — the same approach drizzle-kit's own
 * `migrate()` helper uses, reimplemented here with just the `postgres`
 * driver so the production image never needs drizzle-kit's dev-only
 * dependencies (esbuild, tsx) at runtime.
 *
 * Usage: node scripts/migrate.mjs
 * Reads DATABASE_URL from the environment.
 */
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "drizzle");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`
      create schema if not exists drizzle
    `;
    await sql`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `;

    const applied = await sql`select hash from drizzle.__drizzle_migrations`;
    const appliedHashes = new Set(applied.map((row) => row.hash));

    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found in drizzle/.");
      return;
    }

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const contents = readFileSync(fullPath, "utf8");
      const hash = createHash("sha256").update(contents).digest("hex");

      if (appliedHashes.has(hash)) {
        console.log(`Skipping already-applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);

      // drizzle-kit separates statements with "--> statement-breakpoint".
      const statements = contents
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          values (${hash}, ${Date.now()})
        `;
      });

      console.log(`Applied: ${file}`);
    }

    console.log("All migrations applied successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
