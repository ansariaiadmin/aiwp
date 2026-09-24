import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";
import { hashPassword, hashToken } from "@/lib/auth/password";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { revokeAllSessionsForUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const resetRecord = rows[0];

  if (!resetRecord) {
    return jsonError("لینک بازیابی نامعتبر یا منقضی شده است.", 400);
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(users)
    .set({ passwordHash, failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, resetRecord.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetRecord.id));

  // Invalidate every existing session — a password reset should log the
  // user out everywhere, including any attacker who had a live session.
  await revokeAllSessionsForUser(resetRecord.userId);

  await recordAuditLog({
    actorId: resetRecord.userId,
    action: "auth.password.reset_completed",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ message: "رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید." });
}
