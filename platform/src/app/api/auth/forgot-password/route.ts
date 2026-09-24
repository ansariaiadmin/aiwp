import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateToken } from "@/lib/auth/password";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { consumeRateLimit, passwordResetLimiter, RateLimitExceededError } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { recordAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const body = await request.json().catch(() => null);
  const parsed = requestPasswordResetSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const { email } = parsed.data;

  try {
    await consumeRateLimit(passwordResetLimiter, `${ip}:${email}`);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return jsonError("تعداد درخواست‌ها زیاد بوده، کمی بعد دوباره تلاش کنید.", 429);
    }
    throw e;
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  // Always return the same generic success response regardless of whether
  // the account exists — prevents user enumeration via this endpoint.
  const genericResponse = () =>
    jsonOk({ message: "اگر این ایمیل در سامانه ثبت شده باشد، لینک بازیابی برایش ارسال می‌شود." });

  if (!user) {
    return genericResponse();
  }

  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  await sendPasswordResetEmail(user.email, token).catch((err) => {
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  });

  await recordAuditLog({
    actorId: user.id,
    action: "auth.password.reset_requested",
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return genericResponse();
}
