/**
 * Core license business logic, shared by every /api/license/* route.
 * Implements exactly the contract modules/license-client/src/LicenseClient.php
 * expects: activate / deactivate / validate / update-check / info, each
 * returning { success: boolean, ... } as plain JSON (never HTML), matching
 * how wp_remote_post()'s response body is json_decode()'d on the PHP side.
 */
import { db } from "@/lib/db";
import { licenses, licenseActivations, products } from "@/lib/db/schema";
import { and, count, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";

export interface LicenseCallInput {
  licenseKey: string;
  productSlug: string;
  siteUrl: string;
  ip?: string | null;
}

function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

async function findLicenseWithProduct(licenseKey: string, productSlug: string) {
  const rows = await db
    .select({
      license: licenses,
      product: products,
    })
    .from(licenses)
    .innerJoin(products, eq(licenses.productId, products.id))
    .where(and(eq(licenses.key, licenseKey), eq(products.slug, productSlug)))
    .limit(1);

  return rows[0] ?? null;
}

export async function activateLicense(input: LicenseCallInput) {
  const found = await findLicenseWithProduct(input.licenseKey, input.productSlug);

  if (!found) {
    return { success: false, message: "کلید لایسنس معتبر نیست." };
  }

  const { license, product } = found;

  if (license.status === "SUSPENDED") {
    return { success: false, message: "این لایسنس مسدود شده است." };
  }

  if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
    return { success: false, message: "این لایسنس منقضی شده است." };
  }

  const siteUrl = normalizeSiteUrl(input.siteUrl);

  // Already active on this site: just refresh the heartbeat.
  const existingActivation = await db
    .select()
    .from(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, license.id),
        eq(licenseActivations.siteUrl, siteUrl),
        isNull(licenseActivations.deactivatedAt),
      ),
    )
    .limit(1);

  if (existingActivation.length > 0) {
    await db
      .update(licenseActivations)
      .set({ lastSeenAt: new Date(), ip: input.ip ?? undefined })
      .where(eq(licenseActivations.id, existingActivation[0].id));

    return { success: true, message: "این سایت از قبل فعال بود." };
  }

  // Re-activation path: this site was activated and later deactivated.
  // Reuse the old row via a compare-and-set on deactivated_at — inserting a
  // fresh row for a deactivated pair is legal now (partial unique index,
  // migration 0006), but reusing the row keeps one history per site.
  const prior = await db
    .select({ id: licenseActivations.id })
    .from(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, license.id),
        eq(licenseActivations.siteUrl, siteUrl),
        isNotNull(licenseActivations.deactivatedAt),
      ),
    )
    .orderBy(desc(licenseActivations.activatedAt))
    .limit(1);

  if (prior.length > 0) {
    const [claimed] = await db
      .update(licenseActivations)
      .set({
        deactivatedAt: null,
        activatedAt: new Date(),
        lastSeenAt: new Date(),
        ip: input.ip ?? undefined,
      })
      .where(
        and(
          eq(licenseActivations.id, prior[0].id),
          isNotNull(licenseActivations.deactivatedAt),
        ),
      )
      .returning({ id: licenseActivations.id });

    if (claimed) {
      if (license.status !== "ACTIVE") {
        await db.update(licenses).set({ status: "ACTIVE" }).where(eq(licenses.id, license.id));
      }

      await recordAuditLog({
        action: "license.activated",
        targetType: "license",
        targetId: license.id,
        metadata: { siteUrl, product: product.slug, reactivated: true },
        ip: input.ip,
      });

      return { success: true, message: "لایسنس با موفقیت فعال شد." };
    }

    // A concurrent request re-activated the same site a moment ago.
    return { success: true, message: "این سایت از قبل فعال بود." };
  }

  // Fresh activation. The max-activations check and the insert happen in
  // one transaction so two simultaneous first-activations cannot exceed
  // maxActivations (the old check-then-insert had a race window). The
  // partial unique index is the last line of defence: if a concurrent
  // request claimed this exact site first, we report success for the
  // existing activation instead of erroring.
  let result: { success: boolean; message: string } = {
    success: false,
    message: "خطایی در زمان فعال‌سازی لایسنس رخ داد.",
  };

  await db.transaction(async (tx) => {
    const [{ activeCount }] = await tx
      .select({ activeCount: count() })
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, license.id), isNull(licenseActivations.deactivatedAt)));

    if (activeCount >= license.maxActivations) {
      result = {
        success: false,
        message: `این لایسنس به حداکثر تعداد فعال‌سازی (${license.maxActivations}) رسیده است.`,
      };
      return;
    }

    try {
      await tx.insert(licenseActivations).values({ licenseId: license.id, siteUrl, ip: input.ip ?? undefined });
    } catch (error) {
      if (isUniqueViolation(error)) {
        result = { success: true, message: "این سایت از قبل فعال بود." };
        return;
      }
      throw error;
    }

    if (license.status !== "ACTIVE") {
      await tx.update(licenses).set({ status: "ACTIVE" }).where(eq(licenses.id, license.id));
    }

    result = { success: true, message: "لایسنس با موفقیت فعال شد." };
  });

  if (result.success && result.message === "لایسنس با موفقیت فعال شد.") {
    await recordAuditLog({
      action: "license.activated",
      targetType: "license",
      targetId: license.id,
      metadata: { siteUrl, product: product.slug },
      ip: input.ip,
    });
  }

  return result;
}

/** PostgreSQL unique-violation (23505) detection — postgres.js exposes the
 *  SQLSTATE on the thrown error. */
function isUniqueViolation(error: unknown): boolean {
  return error !== null && typeof error === "object" && (error as { code?: string }).code === "23505";
}

export async function deactivateLicense(input: LicenseCallInput) {
  const found = await findLicenseWithProduct(input.licenseKey, input.productSlug);

  if (!found) {
    return { success: false, message: "کلید لایسنس معتبر نیست." };
  }

  const siteUrl = normalizeSiteUrl(input.siteUrl);

  await db
    .update(licenseActivations)
    .set({ deactivatedAt: new Date() })
    .where(
      and(
        eq(licenseActivations.licenseId, found.license.id),
        eq(licenseActivations.siteUrl, siteUrl),
        isNull(licenseActivations.deactivatedAt),
      ),
    );

  await recordAuditLog({
    action: "license.deactivated",
    targetType: "license",
    targetId: found.license.id,
    metadata: { siteUrl },
    ip: input.ip,
  });

  return { success: true, message: "لایسنس غیرفعال شد." };
}

export async function validateLicense(input: LicenseCallInput) {
  const found = await findLicenseWithProduct(input.licenseKey, input.productSlug);

  if (!found) {
    return { success: false, message: "کلید لایسنس معتبر نیست." };
  }

  const { license } = found;
  const expired = license.expiresAt ? license.expiresAt.getTime() < Date.now() : false;

  if (expired && license.status !== "EXPIRED") {
    await db.update(licenses).set({ status: "EXPIRED" }).where(eq(licenses.id, license.id));
  }

  const isValid = license.status === "ACTIVE" && !expired;

  return { success: isValid, status: expired ? "EXPIRED" : license.status };
}

export async function checkForUpdate(input: LicenseCallInput) {
  const found = await findLicenseWithProduct(input.licenseKey, input.productSlug);

  if (!found) {
    return { success: false, message: "کلید لایسنس معتبر نیست." };
  }

  const { license, product } = found;
  const isActive = license.status === "ACTIVE" && (!license.expiresAt || license.expiresAt.getTime() > Date.now());

  if (!isActive) {
    return { success: false, message: "لایسنس فعال نیست." };
  }

  return {
    success: true,
    new_version: product.currentVersion,
    package_url: product.packageUrl ?? "",
    changelog: product.changelog ?? "",
    tested: undefined,
  };
}

/**
 * Product details for the plugin's "View details" dialog. The license key
 * must exist for this product — the payload (description, changelog,
 * version) is license-scope information, so a keyless probe by slug alone
 * must not return it. The license does NOT have to be active: a buyer
 * with a valid-but-not-yet-activated key still sees the product page.
 */
export async function getProductInfo(productSlug: string, licenseKey: string) {
  const licenseRows = await db
    .select({ productId: licenses.productId, key: licenses.key })
    .from(licenses)
    .where(eq(licenses.key, licenseKey))
    .limit(1);

  if (licenseRows.length === 0) {
    return { success: false, message: "کلید لایسنس معتبر نیست." };
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, productSlug), eq(products.id, licenseRows[0].productId)))
    .limit(1);
  const product = rows[0];

  if (!product) {
    return { success: false, message: "محصول یافت نشد." };
  }

  return {
    success: true,
    new_version: product.currentVersion,
    description: product.description ?? "",
    changelog: product.changelog ?? "",
  };
}

export async function getExpiringActivationsCountForLicense(licenseId: string) {
  const rows = await db
    .select()
    .from(licenseActivations)
    .where(and(eq(licenseActivations.licenseId, licenseId), isNull(licenseActivations.deactivatedAt)));

  return rows.length;
}
