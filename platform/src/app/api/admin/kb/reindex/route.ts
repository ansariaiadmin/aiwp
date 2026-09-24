import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonOk, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { getAiProviderConfig } from "@/lib/settings";
import { reindexAll, embeddingConfigFromSettings } from "@/lib/rag";

/**
 * POST /api/admin/kb/reindex  { "force": true? }
 *
 * Re-embeds documents whose stored embedding model differs from the current
 * one (or all of them with force). This is the controlled switch that keeps
 * vectors from different models from ever being ranked together.
 */
export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };

  const config = await getAiProviderConfig();

  const result = await reindexAll(embeddingConfigFromSettings(config), Boolean(body.force));

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "kb.document.ingested",
    targetType: "kb_reindex",
    targetId: "all",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { kind: "kb-reindex", force: Boolean(body.force), ...result },
  });

  return jsonOk({ ...result });
}
