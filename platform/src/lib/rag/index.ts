/**
 * Knowledge base: ingest documents, then retrieve the chunks that answer a
 * query.
 *
 * Retrieval is hybrid on purpose. Pure vector search misses exact terms —
 * an operator searching "HPOS" wants documents containing that literal
 * string, and an embedding model may place it nowhere near a synonym. Pure
 * keyword search misses paraphrase. So both run and the ranks are fused with
 * Reciprocal Rank Fusion, which needs no tuned weights and cannot be gamed
 * by one side returning very large scores.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbChunks, kbDocuments, EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import { embedText, embedTexts, localEmbed, type EmbeddingConfig } from "./embeddings";
import { chunkText, estimateTokens } from "./chunk";
import { normalizeForSearch, contentHash } from "./normalize";

export type KbSourceKind = "DOCS" | "SUPPORT" | "MARKETPLACE" | "CHANGELOG" | "CODE" | "MANUAL";

export interface IngestInput {
  sourceKind: KbSourceKind;
  sourceKey: string;
  title: string;
  body: string;
  url?: string;
}

export interface IngestResult {
  documentId: string;
  chunks: number;
  /** Which embedder produced the vectors — surfaces in the admin UI. */
  embeddingModel: string;
  embeddingKind: "local" | "openai" | "google";
  /** True when the document was unchanged and re-embedding was skipped. */
  skipped?: boolean;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  sourceKind: KbSourceKind;
  url: string | null;
  content: string;
  /** Reciprocal-rank-fusion score; higher is better. Not a probability. */
  score: number;
  /** Which signal found it, so the UI can explain the ranking. */
  matchedBy: ("vector" | "keyword")[];
}

/**
 * Builds the embedding configuration from the platform's AI settings.
 *
 * Falls back to the local hash embedder when no key is configured, which is
 * what makes the knowledge base usable on a fresh install with no account
 * anywhere.
 */
export function embeddingConfigFromSettings(settings: {
  provider: string;
  apiKey?: string | null;
  model?: string | null;
  baseUrl?: string | null;
}): EmbeddingConfig {
  if (!settings.apiKey) {
    return { kind: "local" };
  }

  const kind = settings.provider === "google" ? "google" : "openai";

  return {
    kind,
    apiKey: settings.apiKey,
    model: settings.model ?? undefined,
    baseUrl: settings.baseUrl ?? undefined,
  };
}

/**
 * Inserts or replaces a document and its chunks.
 *
 * Idempotent on (sourceKind, sourceKey): re-ingesting the same source
 * replaces its chunks rather than duplicating them, so a crawler can be run
 * repeatedly without the corpus growing without bound.
 *
 * Chunks are written first with a null embedding and then updated, so a
 * failure part-way through leaves rows that retrieval skips instead of rows
 * with a half-written vector.
 */
export async function ingestDocument(
  input: IngestInput,
  config: EmbeddingConfig = { kind: "local" },
): Promise<IngestResult> {
  const modelLabel =
    config.kind === "local" || !config.apiKey ? "local-hash" : (config.model ?? config.kind);

  const hash = await contentHash(input.body);

  // Incremental indexing: if the normalised content and the embedding model
  // are both unchanged, re-ingesting is a no-op. Without this, a crawler
  // re-running over the same corpus re-embeds every document on every pass.
  const [existing] = await db
    .select({
      id: kbDocuments.id,
      hash: kbDocuments.contentHash,
      model: kbDocuments.indexedEmbeddingModel,
    })
    .from(kbDocuments)
    .where(
      and(
        eq(kbDocuments.sourceKind, input.sourceKind),
        eq(kbDocuments.sourceKey, input.sourceKey),
      ),
    )
    .limit(1);

  if (existing && existing.hash === hash && existing.model === modelLabel) {
    return {
      documentId: existing.id,
      chunks: 0,
      embeddingModel: modelLabel,
      embeddingKind: config.kind,
      skipped: true,
    };
  }

  const pieces = chunkText(input.body);
  // The retrieval version is normalised; the stored content stays verbatim.
  const searchPieces = pieces.map(normalizeForSearch);

  const [doc] = await db
    .insert(kbDocuments)
    .values({
      sourceKind: input.sourceKind,
      sourceKey: input.sourceKey,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      embeddingModel: null,
      contentHash: hash,
      chunkCount: pieces.length,
    })
    .onConflictDoUpdate({
      target: [kbDocuments.sourceKind, kbDocuments.sourceKey],
      set: {
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        chunkCount: pieces.length,
        lastIngestedAt: new Date(),
        embeddingModel: null,
        contentHash: hash,
      },
    })
    .returning({ id: kbDocuments.id });

  await db.delete(kbChunks).where(eq(kbChunks.documentId, doc.id));

  if (pieces.length === 0) {
    await db
      .update(kbDocuments)
      .set({ embeddingModel: modelLabel, indexedEmbeddingModel: modelLabel })
      .where(eq(kbDocuments.id, doc.id));

    return {
      documentId: doc.id,
      chunks: 0,
      embeddingModel: modelLabel,
      embeddingKind: config.kind,
    };
  }

  const { vectors, model, kind } = await embedTexts(searchPieces, config);

  await db
    .insert(kbChunks)
    .values(
      pieces.map((content, i) => ({
        documentId: doc.id,
        ordinal: i,
        content,
        searchText: searchPieces[i],
        embedding: vectors[i] ?? null,
        tokenEstimate: estimateTokens(content),
      })),
    );

  await db
    .update(kbDocuments)
    .set({ embeddingModel: model, indexedEmbeddingModel: model })
    .where(eq(kbDocuments.id, doc.id));

  return { documentId: doc.id, chunks: pieces.length, embeddingModel: model, embeddingKind: kind };
}

/**
 * Reciprocal Rank Fusion.
 *
 * k=60 is the value from the original RRF paper and is the usual default; it
 * damps the influence of the very top rank so one strong signal does not
 * dominate entirely.
 */
const RRF_K = 60;

function fuseRanks(rankLists: string[][]): Map<string, { score: number; sources: Set<number> }> {
  const fused = new Map<string, { score: number; sources: Set<number> }>();

  rankLists.forEach((ids, listIndex) => {
    ids.forEach((id, rank) => {
      const entry = fused.get(id) ?? { score: 0, sources: new Set<number>() };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.sources.add(listIndex);
      fused.set(id, entry);
    });
  });

  return fused;
}

/** pgvector's text form. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Builds an OR-ed tsquery from free text.
 *
 * plainto_tsquery() ANDs every term, so "how do I declare HPOS support"
 * becomes 'how' & 'do' & 'i' & 'declare' & 'hpos' & 'support' and matches
 * nothing unless the document happens to contain every one of those words —
 * including the stopwords. That silently killed the keyword signal entirely.
 *
 * Terms are tokenised to letters/digits and single-quoted before joining, so
 * user input cannot inject tsquery operators. The 'simple' config is used
 * because the corpus is substantially Persian, where an English stemmer and
 * stopword list do more harm than good.
 */
function buildOrTsquery(text: string): string {
  const terms = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((t) => `'${t.replace(/'/g, "''")}'`)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  return terms.join(" | ");
}

/**
 * Cosine distance above which a vector match is treated as irrelevant and
 * dropped, per embedder.
 *
 * Two different numbers because the two embedders produce genuinely
 * different distance distributions, and a single constant calibrated on one
 * silently breaks the other.
 *
 * Local hash embedder (bag of words): a short query shares few tokens with a
 * long document, so even an on-topic match sits far away. Measured on a real
 * corpus — "HPOS custom order tables support" scored 0.506, the shorter "how
 * to declare HPOS support" 0.770, while "best recipe for chocolate cake"
 * scored 0.901. 0.85 keeps the on-topic short query and still rejects the
 * off-topic one.
 *
 * Real embedding models place unrelated text much further apart, so the
 * tighter 0.75 is right there and keeps precision up.
 *
 * Without a cutoff at all, every query returns the whole corpus ranked, so a
 * search for "chocolate cake" confidently returns documentation about HPOS.
 * A retriever that cannot say "nothing here" is worse than one that returns
 * fewer results, because the caller feeds the junk straight to a model.
 */
export const MAX_DISTANCE_BY_KIND = {
  local: 0.85,
  openai: 0.75,
  google: 0.75,
} as const;

export const DEFAULT_MAX_DISTANCE = MAX_DISTANCE_BY_KIND.local;

export interface SearchOptions {
  limit?: number;
  /** Restrict to these source kinds, e.g. only DOCS. */
  sourceKinds?: KbSourceKind[];
  config?: EmbeddingConfig;
  /** Set to 2 to disable the relevance cutoff entirely. */
  maxDistance?: number;
}

/**
 * Searches the knowledge base.
 *
 * Returns chunks in descending relevance. An empty corpus returns an empty
 * array rather than throwing, so a caller can offer a "no documentation
 * indexed yet" message instead of an error.
 */
export async function searchKnowledge(
  query: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const limit = options.limit ?? 8;
  const config = options.config ?? { kind: "local" as const };
  // Pick the cutoff for the embedder actually in use. Note the local
  // fallback below can differ from config.kind when kind is set but no API
  // key is present, so resolve it the same way embedTexts() will.
  const effectiveKind: "local" | "openai" | "google" =
    config.kind === "local" || !config.apiKey ? "local" : config.kind;

  const maxDistance = options.maxDistance ?? MAX_DISTANCE_BY_KIND[effectiveKind];

  const trimmed = query.trim();

  if (trimmed.length === 0) return [];

  // Normalise exactly as the index was built, so a query spelled with Arabic
  // or Latin variants still matches the canonical stored tokens.
  const normalised = normalizeForSearch(trimmed);
  const tsquery = buildOrTsquery(normalised);

  const kindFilter =
    options.sourceKinds && options.sourceKinds.length > 0
      ? sql`${kbDocuments.sourceKind} = ANY(${options.sourceKinds})`
      : undefined;

  // --- signal 1: keyword (Postgres full-text search) ---------------------
  //
  // plainto_tsquery with the 'simple' config rather than 'english', because
  // the corpus is substantially Persian and an English stemmer/dictionary
  // would reduce Persian tokens to noise.
  const keywordRows = await db
    .select({
      chunkId: kbChunks.id,
      documentId: kbChunks.documentId,
      title: kbDocuments.title,
      sourceKind: kbDocuments.sourceKind,
      url: kbDocuments.url,
      content: kbChunks.content,
      rank: sql<number>`ts_rank(to_tsvector('simple', coalesce(${kbChunks.searchText}, ${kbChunks.content})), to_tsquery('simple', ${tsquery}))`,
    })
    .from(kbChunks)
    .innerJoin(kbDocuments, eq(kbChunks.documentId, kbDocuments.id))
    .where(
      kindFilter
        ? and(
            sql`to_tsvector('simple', coalesce(${kbChunks.searchText}, ${kbChunks.content})) @@ to_tsquery('simple', ${tsquery})`,
            kindFilter,
          )
        : sql`to_tsvector('simple', coalesce(${kbChunks.searchText}, ${kbChunks.content})) @@ to_tsquery('simple', ${tsquery})`,
    )
    .orderBy(desc(sql`ts_rank(to_tsvector('simple', coalesce(${kbChunks.searchText}, ${kbChunks.content})), to_tsquery('simple', ${tsquery}))`))
    .limit(limit * 3);

  // --- signal 2: vector similarity ---------------------------------------
  //
  // Chunks with a null embedding (a partially-ingested document) are
  // excluded, so an in-flight ingest cannot surface unranked text.
  const queryVector =
    config.kind === "local" || !config.apiKey
      ? localEmbed(normalised)
      : await embedText(normalised, config);

  const vectorRows = await db
    .select({
      chunkId: kbChunks.id,
      documentId: kbChunks.documentId,
      title: kbDocuments.title,
      sourceKind: kbDocuments.sourceKind,
      url: kbDocuments.url,
      content: kbChunks.content,
      distance: sql<number>`${kbChunks.embedding} <=> ${toVectorLiteral(queryVector)}`,
    })
    .from(kbChunks)
    .innerJoin(kbDocuments, eq(kbChunks.documentId, kbDocuments.id))
    .where(
      and(
        sql`${kbChunks.embedding} IS NOT NULL`,
        // The cutoff. Chunks with no embedding are excluded above, so an
        // in-flight ingest cannot surface text that was never ranked.
        sql`${kbChunks.embedding} <=> ${toVectorLiteral(queryVector)} <= ${maxDistance}`,
        kindFilter,
      ),
    )
    .orderBy(sql`${kbChunks.embedding} <=> ${toVectorLiteral(queryVector)}`)
    .limit(limit * 3);

  // --- fuse ---------------------------------------------------------------
  const fused = fuseRanks([
    keywordRows.map((r) => r.chunkId),
    vectorRows.map((r) => r.chunkId),
  ]);

  // The two signals select different score columns (ts_rank vs. distance),
  // so the fused map holds only the fields both produce. Without this the
  // Map's value type is inferred from the first array and the second push
  // fails to type-check.
  type FusableRow = Pick<
    (typeof keywordRows)[number],
    "chunkId" | "documentId" | "title" | "sourceKind" | "url" | "content"
  >;

  const byId = new Map<string, FusableRow>();
  for (const row of [...keywordRows, ...vectorRows]) {
    if (!byId.has(row.chunkId)) byId.set(row.chunkId, row);
  }

  const results: RetrievedChunk[] = [];

  for (const [chunkId, entry] of fused) {
    const row = byId.get(chunkId);
    if (!row) continue;

    results.push({
      chunkId,
      documentId: row.documentId,
      title: row.title,
      sourceKind: row.sourceKind as KbSourceKind,
      url: row.url ?? null,
      content: row.content,
      score: entry.score,
      matchedBy: [...entry.sources].map((i) => (i === 0 ? "keyword" : "vector")),
    });
  }

  // Rerank by lexical coverage before truncating, so the chunks that most
  // completely cover the query survive the cut.
  for (const r of results) {
    r.score = r.score * (1 + rerankScore(normalised, r.content));
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * A dependency-free lexical reranker.
 *
 * Hybrid recall (keyword + vector) is good at *finding* candidates but not at
 * *ordering* them by how completely they answer the query. This re-scores each
 * candidate by query-term coverage and exact-phrase presence, both on the
 * normalised text — what a cross-encoder would approximate for lexical
 * queries, without GPU or model weights.
 *
 * Returns a value in [0, 2]: one unit of term coverage plus one for an exact
 * phrase match, applied as a (1 + score) multiplier so it sharpens ordering
 * without drowning out the retrieval signal.
 */
export function rerankScore(query: string, chunkText: string): number {
  const normalisedQuery = normalizeForSearch(query);
  const terms = normalisedQuery.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return 0;

  const normalisedChunk = normalizeForSearch(chunkText);
  const covered = terms.filter((term) => normalisedChunk.includes(term)).length;
  const coverage = covered / terms.length;
  const exact = normalisedChunk.includes(normalisedQuery) ? 1 : 0;

  return coverage + exact;
}

/**
 * Builds the context block handed to the model.
 *
 * Sources are numbered so the answer can cite them, and the whole block is
 * capped by token estimate rather than by chunk count — five long chunks and
 * twenty short ones should not blow the same context window.
 */
export function buildContext(
  chunks: RetrievedChunk[],
  maxTokens = 3000,
): { context: string; usedTokens: number } {
  const parts: string[] = [];
  let used = 0;

  for (const [i, chunk] of chunks.entries()) {
    const cost = estimateTokens(chunk.content) + 12;
    if (used + cost > maxTokens) break;

    parts.push(`[${i + 1}] ${chunk.title}\n${chunk.content}`);
    used += cost;
  }

  return { context: parts.join("\n\n---\n\n"), usedTokens: used };
}

/**
 * Controlled reindex.
 *
 * When the embedding model changes, old vectors and new vectors live in
 * different spaces and must not be ranked together. Rather than silently
 * mixing them, this re-embeds every document with the *current* config and
 * stamps indexedEmbeddingModel, so the switch is atomic per document.
 *
 * `force` re-embeds even documents whose model already matches (e.g. after a
 * chunking change). Without it, only stale documents are touched, which is
 * the cheap common case.
 */
export async function reindexAll(
  config: EmbeddingConfig = { kind: "local" },
  force = false,
): Promise<{ documents: number; reindexed: number; skipped: number }> {
  const modelLabel =
    config.kind === "local" || !config.apiKey ? "local-hash" : (config.model ?? config.kind);

  const docs = await db
    .select({
      id: kbDocuments.id,
      body: kbDocuments.body,
      title: kbDocuments.title,
      sourceKind: kbDocuments.sourceKind,
      sourceKey: kbDocuments.sourceKey,
      url: kbDocuments.url,
      model: kbDocuments.indexedEmbeddingModel,
    })
    .from(kbDocuments);

  let reindexed = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (!force && doc.model === modelLabel) {
      skipped += 1;
      continue;
    }

    await ingestDocument(
      {
        sourceKind: doc.sourceKind,
        sourceKey: doc.sourceKey,
        title: doc.title,
        body: doc.body,
        url: doc.url ?? undefined,
      },
      config,
    );

    reindexed += 1;
  }

  return { documents: docs.length, reindexed, skipped };
}

/** Corpus statistics, for the admin dashboard. */
export async function knowledgeStats(): Promise<{
  documents: number;
  chunks: number;
  embedded: number;
  pendingEmbedding: number;
  embeddingModel: string | null;
}> {
  const [docRow] = await db.select({ count: sql<number>`count(*)::int` }).from(kbDocuments);

  const [chunkRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(*) filter (where ${kbChunks.embedding} is not null)::int`,
    })
    .from(kbChunks);

  const [modelRow] = await db
    .select({ model: kbDocuments.embeddingModel })
    .from(kbDocuments)
    .orderBy(desc(kbDocuments.lastIngestedAt))
    .limit(1);

  return {
    documents: docRow?.count ?? 0,
    chunks: chunkRow?.total ?? 0,
    embedded: chunkRow?.embedded ?? 0,
    pendingEmbedding: (chunkRow?.total ?? 0) - (chunkRow?.embedded ?? 0),
    embeddingModel: modelRow?.model ?? null,
  };
}

export { EMBEDDING_DIMENSIONS };
