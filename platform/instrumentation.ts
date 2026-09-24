/**
 * Next.js instrumentation hook: runs once when the server process starts,
 * before any request is handled. Used here to fail fast on missing/bad
 * environment configuration rather than crashing on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
