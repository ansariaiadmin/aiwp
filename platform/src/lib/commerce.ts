/**
 * Commerce service — the only place an order is created and the only place
 * a purchase grants a license.
 *
 * Two invariants hold the whole flow together:
 *
 *  1. NOTHING grants a license except settleOrder() after the gateway's own
 *     verify() call succeeds. Creating an order, visiting the checkout page
 *     or hitting the callback URL with a hand-made query string grants
 *     nothing.
 *  2. settleOrder() is idempotent. Gateways retry callbacks, buyers reload
 *     the return page, and proxies replay requests. The PAID transition is a
 *     conditional UPDATE ... WHERE status = 'PENDING' compare-and-set, so
 *     only the first caller ever provisions a license; every later call
 *     reports "already settled" instead of handing out a second key.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { licenses, orders, productPlans, products, users } from "@/lib/db/schema";
import { generateLicenseKey } from "@/lib/license-key";
import { getActiveGateway, type PaymentGatewayId } from "@/lib/payment";
import { recordAuditLog } from "@/lib/audit";

/**
 * Excludes I, O, 0 and 1 so a reference read aloud over the phone or typed
 * from a screenshot cannot be mistaken for another character.
 */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DAY_MS = 24 * 60 * 60 * 1000;

export function newOrderReference(now: Date = new Date()): string {
  const date = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  let tail = "";

  for (let i = 0; i < 5; i += 1) {
    tail += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }

  return `AW-${date}-${tail}`;
}

export function orderCallbackUrl(appUrl: string, reference: string): string {
  const base = appUrl.replace(/\/+$/, "");

  return `${base}/api/payment/callback?order=${encodeURIComponent(reference)}`;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; reference: string; gateway: PaymentGatewayId; redirectUrl: string }
  | { ok: false; status: number; message: string };

export interface CreateOrderInput {
  userId: string;
  planId: string;
  /** Absolute origin of this deployment, used to build the callback URL. */
  appUrl: string;
  ip?: string;
  userAgent?: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const planRows = await db
    .select()
    .from(productPlans)
    .where(eq(productPlans.id, input.planId))
    .limit(1);
  const plan = planRows[0];

  if (!plan || !plan.isActive) {
    return { ok: false, status: 404, message: "پلن انتخاب‌شده وجود ندارد یا غیرفعال است." };
  }

  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, plan.productId))
    .limit(1);
  const product = productRows[0];

  if (!product || !product.isActive) {
    return { ok: false, status: 404, message: "این محصول در حال حاضر قابل خرید نیست." };
  }

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const user = userRows[0];

  if (!user) {
    return { ok: false, status: 401, message: "ابتدا وارد حساب خود شوید." };
  }

  const { gateway } = await getActiveGateway();

  const [order] = await db
    .insert(orders)
    .values({
      reference: newOrderReference(),
      userId: user.id,
      productId: product.id,
      planId: plan.id,
      productName: product.name,
      planName: plan.name,
      amount: plan.price,
      currency: plan.currency,
      maxActivations: plan.maxActivations,
      durationDays: plan.durationDays,
      status: "PENDING",
      gateway: gateway.id,
    })
    .returning();

  let created;

  try {
    created = await gateway.create({
      orderId: order.id,
      orderReference: order.reference,
      amount: order.amount,
      currency: order.currency,
      description: `${product.name} — ${plan.name}`,
      buyerEmail: user.email,
      callbackUrl: orderCallbackUrl(input.appUrl, order.reference),
    });
  } catch (error) {
    await db
      .update(orders)
      .set({ status: "FAILED", gatewayMeta: { error: String(error) } })
      .where(eq(orders.id, order.id));

    return {
      ok: false,
      status: 502,
      message: "اتصال به درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.",
    };
  }

  await db
    .update(orders)
    .set({ gatewayRefId: created.gatewayRefId })
    .where(eq(orders.id, order.id));

  await recordAuditLog({
    actorId: user.id,
    action: "order.created",
    targetType: "order",
    targetId: order.id,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      reference: order.reference,
      amount: order.amount,
      currency: order.currency,
      gateway: gateway.id,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    reference: order.reference,
    gateway: gateway.id,
    redirectUrl: created.redirectUrl,
  };
}

export type SettleOrderResult =
  | { ok: true; alreadySettled: boolean; orderId: string; licenseId: string | null }
  | { ok: false; reason: string };

export interface SettleOrderInput {
  reference: string;
  /** Raw query parameters exactly as the gateway returned them. */
  params: Record<string, string | undefined>;
  ip?: string;
  userAgent?: string | null;
}

export async function settleOrder(input: SettleOrderInput): Promise<SettleOrderResult> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.reference, input.reference))
    .limit(1);
  const order = orderRows[0];

  if (!order) {
    return { ok: false, reason: "سفارشی با این شماره یافت نشد." };
  }

  // A settled order is a terminal success: replayed callbacks must not be
  // reported to the buyer as a failure.
  if (order.status === "PAID") {
    return { ok: true, alreadySettled: true, orderId: order.id, licenseId: order.licenseId };
  }

  const { gateway } = await getActiveGateway();
  const result = await gateway.verify({ params: input.params, order });

  if (!result.ok) {
    await db
      .update(orders)
      .set({ status: "FAILED", gatewayMeta: { reason: result.reason } })
      .where(and(eq(orders.id, order.id), eq(orders.status, "PENDING")));

    await recordAuditLog({
      actorId: order.userId,
      action: "order.failed",
      targetType: "order",
      targetId: order.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { reference: order.reference, reason: result.reason },
    });

    return { ok: false, reason: result.reason };
  }

  // Compare-and-set: only the caller that flips the order to PAID provisions
  // a license. FAILED is included so that a callback which failed to verify
  // (a stray/forged one, a buyer who cancelled and came back, a gateway
  // hiccup) does not permanently poison the order — the gateway has now
  // positively confirmed this one, so it is safe to settle.
  const [claimed] = await db
    .update(orders)
    .set({ status: "PAID", paidAt: new Date(), gatewayRefId: result.gatewayRefId })
    .where(and(eq(orders.id, order.id), inArray(orders.status, ["PENDING", "FAILED"])))
    .returning();

  if (!claimed) {
    // Someone else raced us to it. Re-read before reporting anything: the
    // order is only "already settled" if it actually reached PAID. Claiming
    // success for a concurrent failure would show the buyer "paid" while no
    // license was ever issued.
    const current = await db
      .select({ id: orders.id, status: orders.status, licenseId: orders.licenseId })
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1);

    if (current[0]?.status === "PAID") {
      return {
        ok: true,
        alreadySettled: true,
        orderId: order.id,
        licenseId: current[0]?.licenseId ?? null,
      };
    }

    return {
      ok: false,
      reason: "سفارش در وضعیت پرداخت‌شدنی نیست.",
    };
  }

  const expiresAt = order.durationDays
    ? new Date(Date.now() + order.durationDays * DAY_MS)
    : null;

  const [license] = await db
    .insert(licenses)
    .values({
      key: generateLicenseKey(),
      productId: order.productId,
      userId: order.userId,
      status: "INACTIVE",
      maxActivations: order.maxActivations,
      expiresAt,
    })
    .returning();

  await db.update(orders).set({ licenseId: license.id }).where(eq(orders.id, order.id));

  await recordAuditLog({
    actorId: order.userId,
    action: "order.paid",
    targetType: "order",
    targetId: order.id,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { reference: order.reference, gatewayRefId: result.gatewayRefId },
  });

  await recordAuditLog({
    actorId: order.userId,
    action: "license.created",
    targetType: "license",
    targetId: license.id,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { source: "purchase", orderReference: order.reference },
  });

  return { ok: true, alreadySettled: false, orderId: order.id, licenseId: license.id };
}

export async function listOrdersForUser(userId: string) {
  return db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      amount: orders.amount,
      currency: orders.currency,
      gateway: orders.gateway,
      productName: orders.productName,
      planName: orders.planName,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      licenseKey: licenses.key,
      licenseId: licenses.id,
      productSlug: products.slug,
    })
    .from(orders)
    .leftJoin(licenses, eq(orders.licenseId, licenses.id))
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function listAllOrders(limit = 100) {
  return db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      amount: orders.amount,
      currency: orders.currency,
      gateway: orders.gateway,
      gatewayRefId: orders.gatewayRefId,
      productName: orders.productName,
      planName: orders.planName,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
