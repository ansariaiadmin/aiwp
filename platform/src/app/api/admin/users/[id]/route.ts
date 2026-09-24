import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateUserSchema } from "@/lib/validation/admin-users";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { revokeAllSessionsForUser } from "@/lib/auth/session";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  // Only a SUPER_ADMIN may grant/revoke SUPER_ADMIN or ADMIN roles — a
  // plain ADMIN cannot escalate themselves or anyone else.
  if (parsed.data.role && guard.session.role !== "SUPER_ADMIN") {
    return jsonError("فقط ابرمدیر می‌تواند نقش کاربران را تغییر دهد.", 403);
  }

  if (id === guard.session.userId && parsed.data.role && parsed.data.role !== guard.session.role) {
    return jsonError("نمی‌توانید نقش خودتان را تغییر دهید.", 400);
  }

  const [updated] = await db.update(users).set(parsed.data).where(eq(users.id, id)).returning();

  if (!updated) {
    return jsonError("کاربر یافت نشد.", 404);
  }

  if (parsed.data.status === "SUSPENDED") {
    await revokeAllSessionsForUser(id);
  }

  await recordAuditLog({
    actorId: guard.session.userId,
    action: parsed.data.role ? "user.role.changed" : "user.status.changed",
    targetType: "user",
    targetId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: parsed.data,
  });

  return jsonOk({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
    },
  });
}
