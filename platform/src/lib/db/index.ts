import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __aiwpDbClient: ReturnType<typeof postgres> | undefined;
}

function createDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it before starting the platform.",
    );
  }

  // Reuse the connection across hot-reloads in dev; each serverless/edge
  // invocation in production gets its own pooled client via postgres.js's
  // own internal connection pool (max configurable below).
  const client =
    global.__aiwpDbClient ??
    postgres(connectionString, {
      // Default of 10 is right for a real Postgres server. Override via
      // DATABASE_POOL_MAX=1 only for single-connection test backends (e.g.
      // the PGlite dev harness in scripts/dev-pglite-server.mjs, which is a
      // single-threaded WASM Postgres and cannot multiplex several
      // concurrent physical connections the way real Postgres does).
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 20,
      connect_timeout: 10,
      // Disabled by default: prepared statements are incompatible with
      // transaction-mode connection poolers (e.g. PgBouncer in "transaction"
      // pool_mode, which docs/DEPLOYMENT.md recommends for scaling beyond a
      // single app instance) since the pooler may route each statement of a
      // session to a different backend connection. Set
      // DATABASE_USE_PREPARED_STATEMENTS=true only when connecting directly
      // to Postgres (no pooler, or PgBouncer in "session" mode).
      prepare: process.env.DATABASE_USE_PREPARED_STATEMENTS === "true",
      // Skips an extra round-trip to read custom Postgres types at connection
      // time; not needed since this schema only uses standard/enum types.
      fetch_types: false,
    });

  if (process.env.NODE_ENV !== "production") {
    global.__aiwpDbClient = client;
  }

  return drizzle(client, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;

/**
 * The connection is created lazily, on first use, rather than at module
 * evaluation time.
 *
 * This module is imported (transitively) by nearly every route, and Next.js
 * evaluates route modules while collecting page data during `next build`.
 * Eagerly throwing here meant a production build could not run at all unless
 * a real DATABASE_URL was injected at *build* time — which is exactly the
 * wrong moment, because the value must come from the runtime environment.
 * The Dockerfile previously had to bake build-time placeholders to work
 * around it (docs/AUDIT-2026-09-07.md §3.4).
 *
 * Behaviour is unchanged for real requests: the first query still fails
 * loudly with the same message if DATABASE_URL is missing.
 */
let instance: Database | null = null;

function getInstance(): Database {
  if (!instance) instance = createDb();

  return instance;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    return Reflect.get(getInstance(), property);
  },
  has(_target, property) {
    return Reflect.has(getInstance(), property);
  },
});
