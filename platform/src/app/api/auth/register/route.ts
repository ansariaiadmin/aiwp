import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { consumeRateLimit, registerLimiter, RateLimitExceededError } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit";
import { sendVerificationEmail, isEmailDeliveryConfigured } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    await consumeRateLimit(registerLimiter, ip);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return jsonError("تعداد درخواست‌های شما زیاد بوده، کمی بعد دوباره تلاش کنید.", 429);
    }
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const { name, email, password } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    // Do not reveal whether the account exists to avoid user enumeration;
    // respond identically to the success path.
    return jsonOk({
      message: "اگر این ایمیل قبلاً ثبت نشده باشد، ایمیل تأیید برایتان ارسال می‌شود.",
    });
  }

  const passwordHash = await hashPassword(password);

  // Only gate on email verification when the verification email can actually
  // be delivered. Otherwise the account would wait forever for a link that is
  // merely written to the server log, and the customer could never sign in.
  const needsVerification = isEmailDeliveryConfigured();

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: "CUSTOMER",
      status: needsVerification ? "PENDING_VERIFICATION" : "ACTIVE",
    })
    .returning({ id: users.id });

  if (needsVerification) {
    const { token, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({ userId: user.id, tokenHash, expiresAt });

    await sendVerificationEmail(email, token).catch((err) => {
      logger.error({ err, userId: user.id }, "Failed to send verification email");
    });
  }

  await recordAuditLog({
    actorId: user.id,
    action: "auth.register",
    targetType: "user",
    targetId: user.id,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({
    message: needsVerification
      ? "ثبت‌نام با موفقیت انجام شد. لطفاً ایمیل خود را برای تأیید حساب بررسی کنید."
      : "ثبت‌نام با موفقیت انجام شد. می‌توانید وارد شوید.",
  });
}
