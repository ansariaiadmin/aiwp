import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productPlans, products } from "@/lib/db/schema";
import { jsonOk } from "@/lib/http";

/**
 * Public catalogue: every active product with its active plans. This is the
 * only storefront endpoint that needs no authentication, and it never
 * exposes anything but what a shop visitor is meant to see — no license
 * keys, no user data, no internal settings.
 */
export async function GET() {
  const productRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      currentVersion: products.currentVersion,
      changelog: products.changelog,
    })
    .from(products)
    .where(eq(products.isActive, true));

  const planRows = await db
    .select({
      id: productPlans.id,
      productId: productPlans.productId,
      slug: productPlans.slug,
      name: productPlans.name,
      description: productPlans.description,
      price: productPlans.price,
      currency: productPlans.currency,
      maxActivations: productPlans.maxActivations,
      durationDays: productPlans.durationDays,
      supportDays: productPlans.supportDays,
      isFeatured: productPlans.isFeatured,
      sortOrder: productPlans.sortOrder,
    })
    .from(productPlans)
    .where(eq(productPlans.isActive, true))
    .orderBy(asc(productPlans.sortOrder), asc(productPlans.price));

  const catalogue = productRows.map((product) => ({
    ...product,
    plans: planRows.filter((plan) => plan.productId === product.id),
  }));

  return jsonOk({ products: catalogue });
}
