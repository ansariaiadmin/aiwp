import { NextRequest } from "next/server";
import { settleOrder } from "@/lib/commerce";
import { getClientIp } from "@/lib/http";

/**
 * The gateway's return URL — the single point at which money turns into a
 * license.
 *
 * Deliberately unauthenticated and deliberately excluded from the CSRF
 * origin check: the request arrives from a payment provider (or the buyer's
 * browser coming back from one), not from our own origin. Safety therefore
 * comes entirely from settleOrder() -> gateway.verify(), which asks the
 * provider to confirm the transaction server to server. A forged
 * "?order=AW-...&status=ok" query string verifies against nothing and
 * provisions nothing.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const reference = params.order;

  if (!reference) {
    return redirect(`/`);
  }

  const result = await settleOrder({
    reference,
    params,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return redirect(
      `/dashboard/orders?failed=${encodeURIComponent(reference)}&reason=${encodeURIComponent(result.reason)}`,
    );
  }

  const settled = result.alreadySettled ? "&already=1" : "";

  return redirect(`/dashboard/orders?paid=${encodeURIComponent(reference)}${settled}`);
}

function redirect(path: string) {
  return new Response(null, { status: 303, headers: { Location: path } });
}
