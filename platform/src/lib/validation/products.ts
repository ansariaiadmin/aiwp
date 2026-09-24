import { z } from "zod";

export const createProductSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "شناسه باید کبب-کیس انگلیسی باشد (مثل store-health)"),
  name: z.string().min(2, "نام محصول الزامی است"),
  description: z.string().optional(),
  currentVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "نسخه باید به فرم x.y.z باشد")
    .default("1.0.0"),
  changelog: z.string().optional(),
  packageUrl: z.string().url("آدرس معتبر نیست").optional().or(z.literal("")),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createReleaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "نسخه باید به فرم x.y.z باشد"),
  changelog: z.string().optional(),
  packageUrl: z.string().url("آدرس بسته الزامی است"),
});
