import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { licenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateLicenseStatusSchema } from "@/lib/validation/admin-licenses";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog, type AuditAction } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateLicenseStatusSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const [updated] = await db
    .update(licenses)
    .set({ status: parsed.data.status })
    .where(eq(licenses.id, id))
    .returning();

  if (!updated) {
    return jsonError("لایسنس یافت نشد.", 404);
  }

  const actionMap: Record<string, AuditAction> = {
    SUSPENDED: "license.suspended",
    INACTIVE: "license.revoked",
  };

  await recordAuditLog({
    actorId: guard.session.userId,
    action: actionMap[parsed.data.status] ?? "license.revoked",
    targetType: "license",
    targetId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { newStatus: parsed.data.status },
  });

  return jsonOk({ license: updated });
}
