import { z } from "zod";

export const KB_SOURCE_KINDS = [
  "DOCS",
  "SUPPORT",
  "MARKETPLACE",
  "CHANGELOG",
  "CODE",
  "MANUAL",
] as const;

export const kbIngestSchema = z.object({
  sourceKind: z.enum(KB_SOURCE_KINDS),
  sourceKey: z
    .string()
    .trim()
    .min(1, "کلید منبع الزامی است.")
    .max(500, "کلید منبع بیش از حد طولانی است."),
  title: z.string().trim().min(1, "عنوان الزامی است.").max(300),
  body: z
    .string()
    .trim()
    .min(1, "متن الزامی است.")
    // Deliberately generous: a whole documentation page should fit. Bounded
    // because it is stored verbatim and chunked synchronously.
    .max(500_000, "متن بیش از حد طولانی است (حداکثر ۵۰۰ هزار نویسه)."),
  url: z.string().url("آدرس معتبر نیست.").optional().or(z.literal("")),
});

export const kbSearchSchema = z.object({
  query: z.string().trim().min(1, "عبارت جست‌وجو الزامی است.").max(2000),
  limit: z.coerce.number().int().min(1).max(25).default(8),
  sourceKinds: z.array(z.enum(KB_SOURCE_KINDS)).optional(),
});

export type KbIngestInput = z.infer<typeof kbIngestSchema>;
export type KbSearchInput = z.infer<typeof kbSearchSchema>;
