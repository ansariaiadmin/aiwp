import { requireApiAuth } from "@/lib/api-guard";
import { db } from "@/lib/db";
import { licenses, products, licenseActivations } from "@/lib/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAuth();
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
      productVersion: products.currentVersion,
      packageUrl: products.packageUrl,
    })
    .from(licenses)
    .innerJoin(products, eq(licenses.productId, products.id))
    .where(eq(licenses.userId, guard.session.userId))
    .orderBy(desc(licenses.createdAt));

  const withActivations = await Promise.all(
    rows.map(async (license) => {
      const activations = await db
        .select({ siteUrl: licenseActivations.siteUrl, activatedAt: licenseActivations.activatedAt })
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, license.id), isNull(licenseActivations.deactivatedAt)));

      return { ...license, activations };
    }),
  );

  return jsonOk({ licenses: withActivations });
}
