import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonOk, jsonError, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { getAiProviderConfig } from "@/lib/settings";
import { embeddingConfigFromSettings } from "@/lib/rag";
import { recordLesson } from "@/lib/ai/lessons";
import { QUALITY_RULES } from "@/lib/ai/rules";
import { z } from "zod";

const RULE_IDS = QUALITY_RULES.map((r) => r.id);

const bodySchema = z.object({
  ruleId: z.enum(RULE_IDS as [string, ...string[]]),
  problem: z.string().min(1).max(4000),
  fix: z.string().min(1).max(4000),
  context: z.string().max(4000).optional(),
});

/**
 * POST /api/admin/ai/record-lesson  { ruleId, problem, fix, context? }
 *
 * Writes a correction back into the knowledge base so the agent retrieves it
 * the next time it drafts a similar feature. This is the write half of the
 * self-improvement loop; the read half is the grounding draft-spec already
 * does. One lesson is kept per rule, so the loop stays bounded.
 */
export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const config = await getAiProviderConfig();

  const result = await recordLesson(parsed.data, embeddingConfigFromSettings(config));

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "kb.document.ingested",
    targetType: "kb_lesson",
    targetId: result.lessonKey,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { kind: "kb-lesson", ruleId: parsed.data.ruleId, ...result },
  });

  return jsonOk({ ...result });
}
