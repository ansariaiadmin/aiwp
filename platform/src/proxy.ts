import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge, SESSION_COOKIE } from "@/lib/auth/session-edge";
import { isSameOriginMutation } from "@/lib/origin";

/**
 * Edge middleware: cheap (JWT-signature-only, no DB hit) route gating +
 * security headers on every response. Full session validation (DB lookup,
 * revocation check) still happens in Server Components/Route Handlers via
 * getCurrentSession() — this middleware is a fast first line of defense
 * that keeps unauthenticated users away from protected pages before any
 * page code runs.
 */

const ADMIN_PREFIX = "/admin";
const CUSTOMER_PREFIX = "/dashboard";
const ADMIN_API_PREFIX = "/api/admin";
const CUSTOMER_API_PREFIX = "/api/customer";
const STORE_API_PREFIX = "/api/store";

/**
 * CSRF defense-in-depth for cookie-authenticated, same-origin API routes
 * (/api/admin/*, /api/customer/*, /api/auth/*): rejects any mutating
 * request whose Origin header doesn't match the host this deployment is
 * addressed by. The session cookie is already SameSite=lax, which blocks
 * the classic cross-site form-post CSRF case, but this catches other
 * cross-origin fetch() attempts too. The public /api/license/* endpoints
 * are intentionally excluded — they are called cross-origin, unauthenticated
 * (by license key), from arbitrary WordPress sites, by design.
 *
 * The comparison itself lives in @/lib/origin so it can be unit-tested
 * against the exact header combinations a reverse proxy / the standalone
 * server produce (see src/lib/__tests__/origin.test.ts).
 */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  applySecurityHeaders(response);

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isCustomerRoute = pathname.startsWith(CUSTOMER_PREFIX);
  // /api/store/* is cookie-authenticated and mutating (it creates orders),
  // so it gets the same protection. /api/payment/*, /api/license/* and
  // /api/v1/license/* are deliberately NOT listed: they are called from
  // outside our origin — by a payment provider, and by arbitrary WordPress
  // sites using the license key baked into a generated plugin.
  const isProtectedApi =
    pathname.startsWith(ADMIN_API_PREFIX) ||
    pathname.startsWith(CUSTOMER_API_PREFIX) ||
    pathname.startsWith(STORE_API_PREFIX) ||
    pathname.startsWith("/api/auth/");

  const isOriginAllowed = isSameOriginMutation({
    method: request.method,
    originHeader: request.headers.get("origin"),
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
    hostHeader: request.headers.get("host"),
  });

  if (isProtectedApi && !isOriginAllowed) {
    return NextResponse.json({ success: false, message: "Cross-origin request rejected." }, { status: 403 });
  }

  if (!isAdminRoute && !isCustomerRoute) {
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionTokenEdge(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/403", request.url));
  }

  return response;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match every route except static assets, images and Next.js
     * internals, so security headers land on every real page/API
     * response while avoiding wasted work on _next/static, favicon, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
