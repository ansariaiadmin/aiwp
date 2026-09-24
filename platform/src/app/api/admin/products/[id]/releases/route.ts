import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { products, productReleases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createReleaseSchema } from "@/lib/validation/products";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createReleaseSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

  if (!product) {
    return jsonError("محصول یافت نشد.", 404);
  }

  const [release] = await db
    .insert(productReleases)
    .values({
      productId: id,
      version: parsed.data.version,
      changelog: parsed.data.changelog,
      packageUrl: parsed.data.packageUrl,
    })
    .returning();

  await db
    .update(products)
    .set({
      currentVersion: parsed.data.version,
      changelog: parsed.data.changelog,
      packageUrl: parsed.data.packageUrl,
    })
    .where(eq(products.id, id));

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "product.release.created",
    targetType: "product",
    targetId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { version: parsed.data.version },
  });

  return jsonOk({ release }, 201);
}
