import { z } from "zod";
import { AI_PROVIDERS, SMS_DRIVERS } from "@/lib/settings";

export const aiProviderSchema = z.object({
  provider: z.enum(AI_PROVIDERS.map((p) => p.id) as [string, ...string[]]),
  apiKey: z.string().optional(),
  model: z.string().min(1, "نام مدل الزامی است"),
  baseUrl: z.string().url("آدرس معتبر نیست").optional().or(z.literal("")),
});

export const smsGatewaySchema = z.object({
  driver: z.enum(SMS_DRIVERS.map((d) => d.id) as [string, ...string[]]),
  apiKey: z.string().optional(),
  sender: z.string().optional(),
});
