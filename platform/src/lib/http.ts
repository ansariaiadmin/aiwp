import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function zodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "ورودی نامعتبر است.";
}

/**
 * Extracts the real client IP for rate limiting / audit logging.
 *
 * SECURITY MODEL — TRUST_PROXY is the single switch:
 *
 * - TRUST_PROXY unset/false (default): the app is assumed to be directly
 *   reachable (which is how the documented docker-compose deployment
 *   exposes port 3000). Every IP-carrying header in that situation is
 *   client-forgable, so ALL of them are ignored and the socket peer is
 *   used. An attacker therefore cannot shift their own rate-limit bucket
 *   or their audit-trail IP by sending X-Real-IP etc.
 *
 * - TRUST_PROXY=true: a trusted L7 proxy (nginx/Cloudflare/Vercel) sits
 *   directly in front and sets these headers from the real socket peer:
 *   X-Real-IP (nginx: $remote_addr), cf-connecting-ip (Cloudflare),
 *   true-client-ip / x-client-ip (CDN setups). X-Forwarded-For first
 *   entry is the originating client.
 *
 * The non-proxy fallback returns "127.0.0.1" instead of "unknown" so
 * direct-socket requests share one bucket rather than global
 * (fix for AUDIT §3.6).
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";

  if (trustProxy) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp && realIp.trim()) return realIp.trim();

    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp && cfIp.trim()) return cfIp.trim();

    const trueClientIp = request.headers.get("true-client-ip");
    if (trueClientIp && trueClientIp.trim()) return trueClientIp.trim();

    const xClientIp = request.headers.get("x-client-ip");
    if (xClientIp && xClientIp.trim()) return xClientIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim()) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      return trustProxy ? hops[0] : hops[hops.length - 1];
    }
  }

  return "127.0.0.1";
}

/**
 * Absolute origin of this deployment, as the client addressed it.
 *
 * Prefers the host the reverse proxy recorded (nginx sets `Host $host` and
 * we honour X-Forwarded-Host / X-Forwarded-Proto) and falls back to APP_URL.
 * This is what payment gateways must be given as a callback URL, and it is
 * deliberately NOT `request.nextUrl.host` — under HOSTNAME=0.0.0.0 that is
 * the literal "0.0.0.0:3000" (see src/lib/origin.ts).
 */
export function getAppUrl(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");

  if (host) return `${proto}://${host}`;

  const configured = process.env.APP_URL;

  return configured ? configured.replace(/\/+$/, "") : "http://localhost:3000";
}
