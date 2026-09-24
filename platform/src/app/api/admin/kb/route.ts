import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { getAiProviderConfig } from "@/lib/settings";
import { ingestDocument, knowledgeStats, embeddingConfigFromSettings } from "@/lib/rag";
import { kbIngestSchema } from "@/lib/validation/kb";

/**
 * Knowledge base administration.
 *
 *   GET  — corpus statistics
 *   POST — ingest or replace a document
 */

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const stats = await knowledgeStats();
  const config = await getAiProviderConfig();

  return jsonOk({
    ...stats,
    // Tells the UI whether search is semantic or keyword-weighted, so an
    // operator is not left wondering why results look literal.
    usingRealEmbeddings: Boolean(config.apiKey),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = kbIngestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const config = await getAiProviderConfig();

  const result = await ingestDocument(
    {
      sourceKind: parsed.data.sourceKind,
      sourceKey: parsed.data.sourceKey,
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url || undefined,
    },
    embeddingConfigFromSettings(config),
  );

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "kb.document.ingested",
    targetType: "kb_document",
    targetId: result.documentId,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      kind: "kb-ingest",
      sourceKind: parsed.data.sourceKind,
      sourceKey: parsed.data.sourceKey,
      chunks: result.chunks,
      embeddingModel: result.embeddingModel,
    },
  });

  return jsonOk({
    ...result,
    message:
      result.embeddingKind === "local"
        ? `سند ذخیره شد (${result.chunks} قطعه). توجه: چون کلید embedding تنظیم نشده، از embedder محلی استفاده شد — جست‌وجو کلیدواژه‌محور است.`
        : `سند ذخیره شد (${result.chunks} قطعه) با مدل ${result.embeddingModel}.`,
  });
}
