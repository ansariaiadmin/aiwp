import { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { jsonOk, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  await db
    .update(users)
    .set({ twoFactorEnabled: false, twoFactorSecret: null })
    .where(eq(users.id, guard.session.userId));

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "auth.2fa.disabled",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ message: "احراز هویت دو مرحله‌ای غیرفعال شد." });
}
