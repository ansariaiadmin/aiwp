import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonOk, jsonError, zodErrorMessage } from "@/lib/http";
import { getAiProviderConfig } from "@/lib/settings";
import { embeddingConfigFromSettings } from "@/lib/rag";
import { reviewAndLearn } from "@/lib/ai/lessons";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().min(1).max(200_000),
  context: z.string().max(4000).optional(),
});

/**
 * POST /api/admin/ai/review  { code, context? }
 *
 * The automatic half of the self-improvement loop: scans generated PHP for
 * rule breaches, logs each as a measurable violation event, and writes the
 * correction back into the KB as a lesson so the next draft is grounded in
 * it. Returns the breaches found and how many lessons were recorded.
 */
export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const config = await getAiProviderConfig();

  const result = await reviewAndLearn(parsed.data.code, {
    config: embeddingConfigFromSettings(config),
    context: parsed.data.context,
  });

  return jsonOk({ ...result });
}
