import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { productPlans, products } from "@/lib/db/schema";
import { createPlanSchema } from "@/lib/validation/store";
import { getClientIp, jsonError, jsonOk, zodErrorMessage } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: productPlans.id,
      slug: productPlans.slug,
      name: productPlans.name,
      price: productPlans.price,
      currency: productPlans.currency,
      maxActivations: productPlans.maxActivations,
      durationDays: productPlans.durationDays,
      supportDays: productPlans.supportDays,
      isActive: productPlans.isActive,
      isFeatured: productPlans.isFeatured,
      sortOrder: productPlans.sortOrder,
      productId: productPlans.productId,
      productName: products.name,
    })
    .from(productPlans)
    .innerJoin(products, eq(productPlans.productId, products.id))
    .orderBy(asc(productPlans.sortOrder), asc(productPlans.price));

  return jsonOk({ plans: rows });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, parsed.data.productId))
    .limit(1);

  if (productRows.length === 0) {
    return jsonError("محصول انتخاب‌شده وجود ندارد.", 404);
  }

  const existing = await db
    .select({ id: productPlans.id })
    .from(productPlans)
    .where(eq(productPlans.slug, parsed.data.slug))
    .limit(1);

  if (existing.length > 0) {
    return jsonError("پلنی با این شناسه از قبل وجود دارد.", 409);
  }

  const [plan] = await db
    .insert(productPlans)
    .values({
      productId: parsed.data.productId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      currency: parsed.data.currency,
      maxActivations: parsed.data.maxActivations,
      durationDays: parsed.data.durationDays ?? null,
      supportDays: parsed.data.supportDays,
      isFeatured: parsed.data.isFeatured ?? false,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "product.updated",
    targetType: "plan",
    targetId: plan.id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { slug: plan.slug, price: plan.price, currency: plan.currency },
  });

  return jsonOk({ plan }, 201);
}
