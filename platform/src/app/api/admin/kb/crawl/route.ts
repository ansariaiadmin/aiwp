import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonOk, jsonError, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { getAiProviderConfig } from "@/lib/settings";
import { embeddingConfigFromSettings } from "@/lib/rag";
import { crawlSources, DEFAULT_DOC_SEEDS, type CrawlSource } from "@/lib/rag/crawler";
import { z } from "zod";

const bodySchema = z.object({
  /**
   * Explicit URLs to crawl. Omitted or empty falls back to the shipped
   * WordPress / WooCommerce seed set, so the common case is one click.
   */
  urls: z.array(z.string().url()).max(100).optional(),
  sourceKind: z
    .enum(["DOCS", "SUPPORT", "MARKETPLACE", "CHANGELOG", "CODE"])
    .default("DOCS"),
  maxPages: z.number().int().min(1).max(100).default(50),
});

/**
 * POST /api/admin/kb/crawl  { urls?, sourceKind?, maxPages? }
 *
 * Pulls documentation into the knowledge base. Robots.txt is honoured, pages
 * are fetched serially with a politeness delay, and unchanged content is
 * skipped by hash — so re-running a crawl is cheap and safe.
 */
export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("درخواست خزنده نامعتبر است.", 422);
  }

  const { urls, sourceKind, maxPages } = parsed.data;

  const sources: CrawlSource[] =
    urls && urls.length > 0
      ? urls.map((url) => ({ sourceKind, url }))
      : [...DEFAULT_DOC_SEEDS];

  const config = await getAiProviderConfig();

  const result = await crawlSources(sources, {
    embeddingConfig: embeddingConfigFromSettings(config),
    maxPages,
  });

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "kb.document.ingested",
    targetType: "kb_crawl",
    targetId: sourceKind,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { kind: "kb-crawl", count: sources.length, ...result },
  });

  return jsonOk({ ...result, requested: sources.length });
}
