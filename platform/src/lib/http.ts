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
 * SECURITY: by default does NOT trust first X-Forwarded-For entry (client-supplied
 * and spoofable). nginx sets X-Real-IP to $remote_addr and appends to XFF, so
 * last hop is the real IP. Additional headers (cf-connecting-ip, true-client-ip)
 * are checked for Cloudflare/Vercel setups. Falls back to 127.0.0.1 instead of
 * "unknown" to avoid global rate-limit bucket (fix for AUDIT §3.6).
 * Set TRUST_PROXY=true to trust first XFF entry when behind trusted L7 proxy.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const trueClientIp = request.headers.get("true-client-ip");
  if (trueClientIp && trueClientIp.trim()) return trueClientIp.trim();

  const xClientIp = request.headers.get("x-client-ip");
  if (xClientIp && xClientIp.trim()) return xClientIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim()) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
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
