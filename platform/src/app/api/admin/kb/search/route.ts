import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonError, jsonOk, zodErrorMessage } from "@/lib/http";
import { getAiProviderConfig } from "@/lib/settings";
import { searchKnowledge, embeddingConfigFromSettings } from "@/lib/rag";
import { kbSearchSchema } from "@/lib/validation/kb";

/**
 * GET /api/admin/kb/search?query=…&limit=…
 *
 * Exposed so an operator can check what the retriever actually returns
 * before wiring it into anything user-facing. A RAG system nobody can
 * inspect is a RAG system nobody can debug.
 */
export async function GET(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;

  const parsed = kbSearchSchema.safeParse({
    query: params.get("query") ?? "",
    limit: params.get("limit") ?? undefined,
    sourceKinds: params.getAll("sourceKinds").length > 0 ? params.getAll("sourceKinds") : undefined,
  });

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const config = await getAiProviderConfig();

  const results = await searchKnowledge(parsed.data.query, {
    limit: parsed.data.limit,
    sourceKinds: parsed.data.sourceKinds ?? undefined,
    config: embeddingConfigFromSettings(config),
  });

  return jsonOk({
    query: parsed.data.query,
    count: results.length,
    // Surfaces which signal produced each hit, so a thin result set can be
    // diagnosed rather than guessed at.
    usingRealEmbeddings: Boolean(config.apiKey),
    results: results.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      title: r.title,
      sourceKind: r.sourceKind,
      url: r.url,
      matchedBy: r.matchedBy,
      score: Number(r.score.toFixed(6)),
      excerpt: r.content.length > 400 ? `${r.content.slice(0, 400)}…` : r.content,
    })),
  });
}
