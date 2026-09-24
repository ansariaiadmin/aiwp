import { z } from "zod";
import { MODULE_IDS } from "@/lib/ai/module-catalogue";

/**
 * Input for the "describe it and get a plugin spec" admin action.
 *
 * The description is deliberately generous in length — an operator pasting a
 * client's feature list should not have to trim it — but it is still bounded,
 * because it goes straight into a model prompt.
 */
export const draftSpecSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, "توضیح باید حداقل ۲۰ نویسه باشد تا مدل بتواند spec معناداری بسازد.")
    .max(20_000, "توضیح بیش از حد طولانی است."),
  /** Optional slug override; otherwise the model proposes one. */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "شناسه باید کبب-کیس انگلیسی باشد (مثل store-health)")
    .optional(),
});

/**
 * The subset of the plugin spec the model is asked to produce.
 *
 * It must not invent modules: only ids in MODULE_IDS are accepted. Anything
 * else is stripped here so a hallucinated module surfaces as a validation
 * error at the boundary rather than as a confusing failure deep inside
 * tools/compose.php.
 */
export const draftedSpecSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "slug must be kebab-case"),
  name: z.string().min(2),
  description: z.string().optional(),
  namespace: z
    .string()
    .regex(/^[A-Z][A-Za-z0-9]*(\\[A-Z][A-Za-z0-9]*)+$/, "namespace must be a PHP namespace like Vendor\\Plugin"),
  prefix: z.string().regex(/^[a-z][a-z0-9_]*$/, "prefix must be a lowercase identifier"),
  textDomain: z.string().min(2),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
  modules: z.array(z.enum(MODULE_IDS as unknown as [string, ...string[]])).min(1),
  options: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        type: z.enum(["text", "email", "number", "checkbox", "textarea", "select", "password"]),
        label: z.string().min(1),
        default: z.union([z.string(), z.number(), z.boolean()]).optional(),
        tab: z.string().optional(),
      }),
    )
    .optional(),
  features: z.array(z.string().min(1)).optional(),
});

export type DraftedSpec = z.infer<typeof draftedSpecSchema>;
