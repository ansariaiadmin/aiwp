/**
 * Core license business logic, shared by every /api/license/* route.
 * Implements exactly the contract modules/license-client/src/LicenseClient.php
 * expects: activate / deactivate / validate / update-check / info, each
 * returning { success: boolean, ... } as plain JSON (never HTML), matching
 * how wp_remote_post()'s response body is json_decode()'d on the PHP side.
 */
import { db } from "@/lib/db";
import { licenses, licenseActivations, products } from "@/lib/db/schema";
import { and, eq, isNull, count } from "drizzle-orm";
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

  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(licenseActivations)
    .where(and(eq(licenseActivations.licenseId, license.id), isNull(licenseActivations.deactivatedAt)));

  if (activeCount >= license.maxActivations) {
    return {
      success: false,
      message: `این لایسنس به حداکثر تعداد فعال‌سازی (${license.maxActivations}) رسیده است.`,
    };
  }

  await db.insert(licenseActivations).values({ licenseId: license.id, siteUrl, ip: input.ip ?? undefined });

  if (license.status !== "ACTIVE") {
    await db.update(licenses).set({ status: "ACTIVE" }).where(eq(licenses.id, license.id));
  }

  await recordAuditLog({
    action: "license.activated",
    targetType: "license",
    targetId: license.id,
    metadata: { siteUrl, product: product.slug },
    ip: input.ip,
  });

  return { success: true, message: "لایسنس با موفقیت فعال شد." };
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

export async function getProductInfo(productSlug: string) {
  const rows = await db.select().from(products).where(eq(products.slug, productSlug)).limit(1);
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
