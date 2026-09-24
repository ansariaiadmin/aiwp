/**
 * Structured, secret-redacting application logger (pino). Mirrors the
 * WordPress factory's own Logger class philosophy: never log API keys,
 * tokens, passwords, or session values in plaintext, even accidentally
 * via a nested object.
 */
import pino from "pino";

const REDACT_PATHS = [
  "password",
  "passwordHash",
  "*.password",
  "*.passwordHash",
  "apiKey",
  "*.apiKey",
  "token",
  "*.token",
  "tokenHash",
  "*.tokenHash",
  "sessionToken",
  "authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.secret",
  "*.twoFactorSecret",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: REDACT_PATHS, censor: "***redacted***" },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
});
