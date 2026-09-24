import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { createProductSchema } from "@/lib/validation/products";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  return jsonOk({ products: rows });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, parsed.data.slug))
    .limit(1);

  if (existing.length > 0) {
    return jsonError("محصولی با این شناسه از قبل وجود دارد.", 409);
  }

  const [product] = await db
    .insert(products)
    .values({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      currentVersion: parsed.data.currentVersion,
      changelog: parsed.data.changelog,
      packageUrl: parsed.data.packageUrl || null,
    })
    .returning();

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "product.created",
    targetType: "product",
    targetId: product.id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { slug: product.slug },
  });

  return jsonOk({ product }, 201);
}
