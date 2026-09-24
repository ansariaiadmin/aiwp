/**
 * Same-origin (CSRF) verification for cookie-authenticated, mutating API
 * routes.
 *
 * Why this does NOT use `request.nextUrl.host`:
 *   Next.js's standalone server builds `nextUrl` from the address it is
 *   *listening* on. When the production image runs with `HOSTNAME=0.0.0.0`
 *   (see platform/Dockerfile) `nextUrl.host` is the literal string
 *   `0.0.0.0:3000`, which no browser's Origin header can ever equal — every
 *   mutating request from a real browser was rejected with 403, breaking
 *   login, registration and every admin/customer write in the documented
 *   Docker deployment. The Host / X-Forwarded-Host request headers carry
 *   the host the client actually addressed and are set per-request, so
 *   they are the correct comparison target.
 *
 * Trust model: a browser cannot forge the Host header of a cross-site
 * request, so comparing the attacker-supplied Origin against the Host the
 * request itself arrived on is the standard defense. `X-Forwarded-Host`
 * is honoured (first entry = the public host our reverse proxy saw) and
 * is set by nginx/conf.d/proxy-common.inc's `proxy_set_header Host $host`.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface OriginCheckInput {
  method: string;
  /** Raw `Origin` request header, or null when absent. */
  originHeader: string | null;
  /** Raw `X-Forwarded-Host` header (may be a comma list), or null. */
  forwardedHostHeader?: string | null;
  /** Raw `Host` header, or null. */
  hostHeader?: string | null;
}

/**
 * Normalises a header value to a lowercase `host[:port]` string.
 * Accepts either a full URL (`https://a.example:8443/x`) or a bare
 * authority (`a.example:8443`). Returns null when it cannot be parsed.
 */
/** A bare `host[:port]` authority (hostname, IPv4, or bracketed IPv6). */
const BARE_AUTHORITY = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])(:\d+)?$/i;

function toHost(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Only http(s) URLs carry a meaningful authority. `new URL("app:3000")`
  // happily parses with scheme "app:" and an empty host, so the protocol
  // must be checked before the result is trusted.
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.host.toLowerCase();
    }
  } catch {
    // Not a URL at all — fall through to the bare-authority branch.
  }

  return BARE_AUTHORITY.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Every host this deployment can legitimately be addressed by. */
export function collectTrustedHosts(input: OriginCheckInput): Set<string> {
  const hosts = new Set<string>();

  const forwarded = input.forwardedHostHeader;
  if (forwarded) {
    for (const part of forwarded.split(",")) {
      const host = toHost(part);
      if (host) hosts.add(host);
    }
  }

  const host = toHost(input.hostHeader);
  if (host) hosts.add(host);

  return hosts;
}

/**
 * Returns true when a mutating request is allowed through.
 *
 * - Non-mutating methods are always allowed (they cannot change state).
 * - A missing Origin is allowed: plenty of legitimate same-origin clients
 *   omit it, and the session cookie is already `SameSite=lax`.
 * - A present-but-unparseable Origin is rejected (fail closed).
 * - A parseable Origin is allowed only when its host is one this
 *   deployment is actually addressed by. When no trusted host can be
 *   determined at all, the check also fails closed rather than silently
 *   allowing everything.
 */
export function isSameOriginMutation(input: OriginCheckInput): boolean {
  if (!MUTATING_METHODS.has(input.method.toUpperCase())) return true;

  if (!input.originHeader || !input.originHeader.trim()) return true;

  const originHost = toHost(input.originHeader);
  if (!originHost) return false;

  const trusted = collectTrustedHosts(input);
  if (trusted.size === 0) return false;

  return trusted.has(originHost);
}
