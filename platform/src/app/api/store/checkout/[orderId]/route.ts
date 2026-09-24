import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { mockAuthority } from "@/lib/payment/mock";
import { jsonError, jsonOk } from "@/lib/http";

/**
 * Backs the simulated gateway page at /checkout/[orderId].
 *
 * Scoped to the buyer's own order, and the transaction authority is only
 * ever revealed when the order's gateway is the keyless test gateway — a
 * real gateway's page is hosted by the provider, so this route has nothing
 * to hand out and returns no authority at all.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  const { orderId } = await params;

  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];

  if (!order || order.userId !== guard.session.userId) {
    return jsonError("سفارش یافت نشد.", 404);
  }

  return jsonOk({
    order: {
      id: order.id,
      reference: order.reference,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      productName: order.productName,
      planName: order.planName,
      gateway: order.gateway,
      mockAuthority: order.gateway === "mock" ? mockAuthority(order.reference) : null,
    },
  });
}
