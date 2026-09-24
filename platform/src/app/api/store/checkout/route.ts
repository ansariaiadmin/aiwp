import { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api-guard";
import { checkoutSchema } from "@/lib/validation/store";
import { createOrder } from "@/lib/commerce";
import { getAppUrl, getClientIp, jsonError, jsonOk, zodErrorMessage } from "@/lib/http";

/**
 * Starts a purchase. Requires a signed-in account (the license has to belong
 * to somebody) but no admin rights. Returns the gateway redirect URL; the
 * client navigates there and the gateway eventually calls
 * /api/payment/callback, which is the only thing that provisions a license.
 *
 * Protected by the same-origin CSRF check in src/proxy.ts — it is a
 * cookie-authenticated mutation.
 */
export async function POST(request: NextRequest) {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const result = await createOrder({
    userId: guard.session.userId,
    planId: parsed.data.planId,
    appUrl: getAppUrl(request),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  return jsonOk(
    {
      orderId: result.orderId,
      reference: result.reference,
      gateway: result.gateway,
      redirectUrl: result.redirectUrl,
    },
    201,
  );
}
