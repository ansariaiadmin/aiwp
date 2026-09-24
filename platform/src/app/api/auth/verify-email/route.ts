import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { emailVerificationTokens, users } from "@/lib/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";
import { hashToken } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/http";
import { z } from "zod";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError("توکن نامعتبر است.", 422);
  }

  const tokenHash = hashToken(parsed.data.token);

  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const record = rows[0];

  if (!record) {
    return jsonError("لینک تأیید نامعتبر یا منقضی شده است.", 400);
  }

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), status: "ACTIVE" })
    .where(eq(users.id, record.userId));

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, record.id));

  return jsonOk({ message: "ایمیل شما با موفقیت تأیید شد. اکنون می‌توانید وارد شوید." });
}
