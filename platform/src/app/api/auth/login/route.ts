import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { consumeRateLimit, loginLimiter, RateLimitExceededError } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit";
import { verifyTotp } from "@/lib/auth/totp";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const { email, password, totpCode } = parsed.data;

  try {
    await consumeRateLimit(loginLimiter, `${ip}:${email}`);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return jsonError("تعداد تلاش‌های ورود زیاد بوده، کمی بعد دوباره تلاش کنید.", 429);
    }
    throw e;
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  const genericError = () => jsonError("ایمیل یا رمز عبور اشتباه است.", 401);

  if (!user) {
    return genericError();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAuditLog({
      actorId: user.id,
      action: "auth.login.locked",
      ip,
      userAgent,
    });
    return jsonError(
      "حساب شما به دلیل تلاش‌های ناموفق پیاپی موقتاً قفل شده است. کمی بعد دوباره تلاش کنید.",
      423,
    );
  }

  if (user.status === "SUSPENDED") {
    return jsonError("حساب شما مسدود شده است. با پشتیبانی تماس بگیرید.", 403);
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;

    await db
      .update(users)
      .set({
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      })
      .where(eq(users.id, user.id));

    await recordAuditLog({
      actorId: user.id,
      action: "auth.login.failed",
      ip,
      userAgent,
      metadata: { failedCount },
    });

    return genericError();
  }

  if (user.status === "PENDING_VERIFICATION") {
    return jsonError("لطفاً ابتدا ایمیل خود را تأیید کنید.", 403);
  }

  if (user.twoFactorEnabled) {
    if (!totpCode) {
      return jsonOk({ requiresTwoFactor: true }, 200);
    }

    const valid = user.twoFactorSecret ? verifyTotp(totpCode, user.twoFactorSecret) : false;

    if (!valid) {
      await recordAuditLog({ actorId: user.id, action: "auth.login.failed", ip, userAgent, metadata: { reason: "bad_totp" } });
      return jsonError("کد تأیید دو مرحله‌ای نامعتبر است.", 401);
    }
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip })
    .where(eq(users.id, user.id));

  const token = await createSession(user.id, user.role, { ip, userAgent: userAgent ?? undefined });
  await setSessionCookie(token);

  await recordAuditLog({ actorId: user.id, action: "auth.login.success", ip, userAgent });

  return jsonOk({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
