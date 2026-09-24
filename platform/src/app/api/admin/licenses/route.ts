import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { licenses, users, products } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { createLicenseSchema } from "@/lib/validation/admin-licenses";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { generateLicenseKey } from "@/lib/license-key";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: licenses.id,
      key: licenses.key,
      status: licenses.status,
      maxActivations: licenses.maxActivations,
      expiresAt: licenses.expiresAt,
      createdAt: licenses.createdAt,
      productName: products.name,
      productSlug: products.slug,
      userEmail: users.email,
      userName: users.name,
    })
    .from(licenses)
    .innerJoin(products, eq(licenses.productId, products.id))
    .innerJoin(users, eq(licenses.userId, users.id))
    .orderBy(desc(licenses.createdAt));

  return jsonOk({ licenses: rows });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createLicenseSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.userEmail))
    .limit(1);

  if (userRows.length === 0) {
    return jsonError("کاربری با این ایمیل یافت نشد. ابتدا کاربر باید ثبت‌نام کند.", 404);
  }

  const [license] = await db
    .insert(licenses)
    .values({
      key: generateLicenseKey(),
      productId: parsed.data.productId,
      userId: userRows[0].id,
      maxActivations: parsed.data.maxActivations,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      status: "INACTIVE",
    })
    .returning();

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "license.created",
    targetType: "license",
    targetId: license.id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ license }, 201);
}
