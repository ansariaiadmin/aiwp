/**
 * Rate limiting for auth endpoints and public APIs. Uses an in-memory
 * limiter by default (fine for a single-instance deployment) and
 * transparently upgrades to Redis when REDIS_URL is set (required for
 * multi-instance/horizontal scaling so limits are shared across
 * instances).
 */
import { RateLimiterMemory, RateLimiterRedis, type IRateLimiterOptions } from "rate-limiter-flexible";
import Redis from "ioredis";
import { logger } from "@/lib/logger";

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    redisClient.on("error", (err) => {
      // Never let a Redis hiccup crash the process; rate limiting fails
      // open to memory-based limiting per-instance in that case.
      logger.error({ err: err.message }, "Redis error in rate limiter");
    });
  }

  return redisClient;
}

function makeLimiter(keyPrefix: string, options: IRateLimiterOptions) {
  const redis = getRedisClient();

  if (redis) {
    return new RateLimiterRedis({ storeClient: redis, keyPrefix, ...options });
  }

  return new RateLimiterMemory({ keyPrefix, ...options });
}

/** 5 attempts per 15 minutes per IP+email combo for login. */
export const loginLimiter = makeLimiter("rl_login", { points: 5, duration: 15 * 60 });

/** 3 registrations per hour per IP. */
export const registerLimiter = makeLimiter("rl_register", { points: 3, duration: 60 * 60 });

/** 3 password-reset requests per hour per IP+email. */
export const passwordResetLimiter = makeLimiter("rl_pwreset", { points: 3, duration: 60 * 60 });

/** 60 requests per minute per IP for the public license API. */
export const licenseApiLimiter = makeLimiter("rl_license_api", { points: 60, duration: 60 });

/** 100 requests per minute per IP for general authenticated API traffic. */
export const generalApiLimiter = makeLimiter("rl_general_api", { points: 100, duration: 60 });

export class RateLimitExceededError extends Error {
  constructor(public retrySecs: number) {
    super(`Rate limit exceeded. Retry after ${retrySecs}s.`);
    this.name = "RateLimitExceededError";
  }
}

export async function consumeRateLimit(
  limiter: RateLimiterMemory | RateLimiterRedis,
  key: string,
): Promise<void> {
  try {
    await limiter.consume(key);
  } catch (rejection) {
    const retrySecs =
      rejection && typeof rejection === "object" && "msBeforeNext" in rejection
        ? Math.ceil((rejection as { msBeforeNext: number }).msBeforeNext / 1000)
        : 60;

    throw new RateLimitExceededError(retrySecs);
  }
}
