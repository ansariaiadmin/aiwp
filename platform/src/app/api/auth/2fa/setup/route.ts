import QRCode from "qrcode";
import { getCurrentSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateTotpSecret, buildTotpUri } from "@/lib/auth/totp";

/**
 * Step 1 of enabling 2FA: generates a new TOTP secret and its QR code
 * (as a data URL), but does NOT persist/enable it yet — that only happens
 * once the user proves possession by submitting a valid code to
 * /api/auth/2fa/verify.
 */
export async function POST() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError("لطفاً ابتدا وارد شوید.", 401);
  }

  const secret = generateTotpSecret();
  const otpauthUrl = buildTotpUri(secret, session.email);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Stash the pending (unconfirmed) secret; it only takes effect once
  // /2fa/verify confirms it and flips twoFactorEnabled to true.
  await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, session.userId));

  return jsonOk({ secret, qrCodeDataUrl });
}
