import { z } from "zod";

/**
 * Every request from modules/license-client's LicenseClient::call() posts
 * these three fields at minimum (application/x-www-form-urlencoded, via
 * wp_remote_post()'s default 'body' array behaviour).
 */
export const licenseRequestBaseSchema = z.object({
  license_key: z.string().min(1, "کلید لایسنس الزامی است"),
  product_id: z.string().min(1, "شناسه محصول الزامی است"),
  site_url: z.string().min(1, "آدرس سایت الزامی است"),
});

export type LicenseRequestBase = z.infer<typeof licenseRequestBaseSchema>;
