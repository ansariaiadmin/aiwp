/**
 * DEV/TEST ONLY: runs an in-process PGlite (WASM PostgreSQL) instance
 * exposed over a real TCP socket, so DATABASE_URL=postgresql://... works
 * against the standard `postgres` npm driver exactly like a real Postgres
 * server would — without requiring a system Postgres install. This is
 * never used in production (see docker-compose.prod.yml, which runs real
 * Postgres).
 *
 * maxConnections must be greater than 1. Next.js evaluates route handlers
 * and Server Components in separate module registries, so a single running
 * server legitimately opens more than one physical connection. With the
 * default of 1, the second connection is rejected with "Too many
 * connections" and the client sees ECONNRESET — which surfaced as a 500 on
 * every Server-Component page (/store, /admin, /dashboard) while route
 * handlers worked fine.
 *
 * PGlite itself is single-threaded, so PGLiteSocketServer serialises
 * queries through an internal QueryQueueManager; accepting several sockets
 * does not mean several queries run at once.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { vector } from "@electric-sql/pglite-pgvector";

const PORT = Number(process.env.PGLITE_PORT ?? 5432);
const HOST = process.env.PGLITE_HOST ?? "127.0.0.1";
const MAX_CONNECTIONS = Number(process.env.PGLITE_MAX_CONNECTIONS ?? 32);

/**
 * Where the database lives on disk.
 *
 * Set PGLITE_DATA_DIR to persist across restarts — the launcher
 * (start-aiwp.sh) does this, so accounts, products, orders and licenses
 * survive a reboot. Left unset, PGlite runs purely in memory and everything
 * is lost the moment the process exits, which is only appropriate for
 * throwaway test runs.
 */
const DATA_DIR = process.env.PGLITE_DATA_DIR;

/**
 * pgvector is loaded here rather than assumed, because the knowledge base
 * (src/lib/rag/) needs the vector type and its distance operators. PGlite
 * ships extensions as separately-loaded WASM bundles, so without this the
 * `CREATE EXTENSION vector` in the migration fails with "could not open
 * extension control file".
 *
 * The real Postgres used in production needs the extension installed at the
 * server level (`apt install postgresql-16-pgvector` or equivalent); see
 * docs/DEPLOYMENT.md.
 */
const db = DATA_DIR
  ? new PGlite(DATA_DIR, { extensions: { vector } })
  : new PGlite({ extensions: { vector } });

const server = new PGLiteSocketServer({
  db,
  port: PORT,
  host: HOST,
  maxConnections: MAX_CONNECTIONS,
  debug: process.env.PGLITE_DEBUG === "1",
});

await server.start();

console.log(
  `PGlite dev server listening on postgresql://${HOST}:${PORT} (max ${MAX_CONNECTIONS} connections)`,
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`\nPGlite dev server received ${signal}, shutting down.`);
    await server.stop();
    process.exit(0);
  });
}
