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
 * Extracts the real client IP for rate limiting / audit logging, trusting
 * only the reverse proxy (nginx) directly in front of this app —
 * everything else in the request is attacker-controlled.
 *
 * SECURITY: this deliberately does NOT read the first entry of
 * X-Forwarded-For, because that value is client-supplied and trivially
 * spoofable (`curl -H "X-Forwarded-For: 1.1.1.1"`) — trusting it would let
 * every login/rate-limit/lockout check be bypassed by rotating a fake IP
 * on every request. nginx (see nginx/conf.d/proxy-common.inc) sets:
 *   - X-Real-IP to $remote_addr (the actual TCP peer nginx saw — not
 *     client-controllable), and
 *   - X-Forwarded-For to $proxy_add_x_forwarded_for, which APPENDS the
 *     real peer address as the LAST entry regardless of what the client
 *     sent before it.
 * So we trust X-Real-IP first, and otherwise trust only the last entry of
 * X-Forwarded-For (the hop nearest to us, i.e. our own trusted nginx),
 * never the first (attacker-controlled) one. In local dev, with no proxy
 * in front, both headers are simply absent and this falls back to
 * "unknown" (rate limiting still works — it just keys on that literal
 * string plus other request identifiers).
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim());
    return hops[hops.length - 1] || "unknown";
  }

  return "unknown";
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
