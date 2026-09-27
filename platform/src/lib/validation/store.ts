import { z } from "zod";

/**
 * Currencies the platform actually knows how to price, format and charge:
 * IRR/TMN for the Iranian gateways (see lib/money.ts, lib/payment/*), USD
 * and EUR for Stripe. Restricting plans to this set stops the whole
 * misconfiguration class — e.g. a ZarinPal plan priced in a code the
 * gateway cannot convert.
 */
export const CURRENCIES = ["IRR", "TMN", "USD", "EUR"] as const;

export const currencySchema = z.enum(CURRENCIES);

export const checkoutSchema = z.object({
  planId: z.string().min(1, "پلن را انتخاب کنید."),
});

export const createPlanSchema = z.object({
  productId: z.string().min(1, "محصول را انتخاب کنید."),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "شناسه باید کبب-کیس انگلیسی باشد (مثل single-site)"),
  name: z.string().min(2, "نام پلن الزامی است."),
  description: z.string().optional(),
  /** Smallest currency unit: 1500000 = 1,500,000 IRR; 4900 = $49.00. */
  price: z.coerce.number().int().min(0),
  currency: currencySchema.default("IRR"),
  maxActivations: z.coerce.number().int().min(1).max(100000).default(1),
  durationDays: z.coerce.number().int().min(1).max(36500).nullable().optional(),
  supportDays: z.coerce.number().int().min(0).max(36500).default(180),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().default(0),
});
