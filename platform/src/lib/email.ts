/**
 * Transactional email via Resend. If RESEND_API_KEY is not configured
 * (e.g. local development), emails are logged instead of sent so the
 * rest of the app keeps working without a mail provider.
 */
import { Resend } from "resend";
import { logger } from "@/lib/logger";

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

/**
 * Whether outbound email is genuinely configured.
 *
 * Registration gates new accounts behind an email-verification link. If that
 * link can never actually be delivered — no RESEND_API_KEY, so the "email"
 * is only written to the server log — the account sits in
 * PENDING_VERIFICATION forever and the customer can never sign in. So the
 * gate is applied only when delivery is real; otherwise the account is
 * created active. A self-hosted install that has not wired email must not
 * lock its own first customer out.
 */
export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "AiWp Platform <no-reply@aiwp.local>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

async function send(to: string, subject: string, html: string) {
  const client = getClient();

  if (!client) {
    logger.info({ to, subject }, "Dev-mode email (no RESEND_API_KEY configured)");
    return;
  }

  await client.emails.send({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await send(
    to,
    "تأیید ایمیل — AiWp Platform",
    `<p>برای تأیید ایمیل خود روی لینک زیر کلیک کنید:</p><p><a href="${link}">${link}</a></p><p>این لینک تا ۲۴ ساعت معتبر است.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await send(
    to,
    "بازیابی رمز عبور — AiWp Platform",
    `<p>برای تنظیم رمز عبور جدید روی لینک زیر کلیک کنید:</p><p><a href="${link}">${link}</a></p><p>اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید. این لینک تا ۱ ساعت معتبر است.</p>`,
  );
}
