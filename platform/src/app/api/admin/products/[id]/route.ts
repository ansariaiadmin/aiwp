import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateProductSchema } from "@/lib/validation/products";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const updateData = { ...parsed.data };
  if (updateData.packageUrl === "") {
    updateData.packageUrl = undefined;
  }

  const [updated] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();

  if (!updated) {
    return jsonError("محصول یافت نشد.", 404);
  }

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "product.updated",
    targetType: "product",
    targetId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ product: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await db.delete(products).where(eq(products.id, id));

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "product.deleted",
    targetType: "product",
    targetId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ message: "محصول حذف شد." });
}
