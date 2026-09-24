import { z } from "zod";

export const createLicenseSchema = z.object({
  productId: z.string().min(1, "محصول را انتخاب کنید"),
  userEmail: z.string().email("ایمیل معتبر نیست"),
  maxActivations: z.coerce.number().int().min(1).max(1000).default(1),
  expiresAt: z.string().optional(),
});

export const updateLicenseStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"]),
});
