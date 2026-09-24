import { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const rows = await db.select().from(users).where(eq(users.id, guard.session.userId)).limit(1);
  const user = rows[0];

  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return jsonError("رمز عبور فعلی نادرست است.", 400);
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  await recordAuditLog({
    actorId: user.id,
    action: "auth.password.changed",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ message: "رمز عبور با موفقیت تغییر کرد." });
}
