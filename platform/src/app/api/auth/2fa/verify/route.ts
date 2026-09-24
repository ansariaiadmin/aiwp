import { NextRequest } from "next/server";
import { verifyTotp } from "@/lib/auth/totp";
import { getCurrentSession } from "@/lib/auth/session";
import { jsonError, jsonOk, getClientIp } from "@/lib/http";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ code: z.string().regex(/^\d{6}$/, "کد باید ۶ رقمی باشد") });

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError("لطفاً ابتدا وارد شوید.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError("کد نامعتبر است.", 422);
  }

  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = rows[0];

  if (!user?.twoFactorSecret) {
    return jsonError("ابتدا فرآیند فعال‌سازی را شروع کنید.", 400);
  }

  const valid = verifyTotp(parsed.data.code, user.twoFactorSecret);

  if (!valid) {
    return jsonError("کد وارد شده نادرست است.", 400);
  }

  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, session.userId));

  await recordAuditLog({
    actorId: session.userId,
    action: "auth.2fa.enabled",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ message: "احراز هویت دو مرحله‌ای با موفقیت فعال شد." });
}
