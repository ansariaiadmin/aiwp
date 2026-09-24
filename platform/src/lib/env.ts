/**
 * Validates required environment variables at boot (imported once from
 * instrumentation.ts). Fails fast with a clear error instead of a mystery
 * runtime crash halfway through a request.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY must be at least 16 characters"),
  REDIS_URL: z.string().optional(),
  APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `Invalid/missing environment variables. Copy .env.example to .env and fix:\n${issues}`,
    );
  }
}
