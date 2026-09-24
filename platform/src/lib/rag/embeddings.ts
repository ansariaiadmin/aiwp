/**
 * Turns text into vectors for the knowledge base.
 *
 * Two implementations, chosen by configuration:
 *
 *   * a real embedding model, when the operator has configured one —
 *     OpenAI-compatible /v1/embeddings or Google's embedContent
 *   * a deterministic local hash embedder, used when no key is configured
 *
 * The local one matters more than it looks. Without it the knowledge base is
 * dead on arrival for anyone who unzips this project and has no API key,
 * which is the first thing they will try. It is a bag-of-words vector:
 * lexical overlap only, no semantics, and it is honest about that — the
 * caller can tell which produced a result. It makes keyword-ish retrieval
 * work immediately and degrades gracefully, and switching to a real model
 * later is a settings change plus a re-ingest, not a rewrite.
 */

import { LlmError, LlmTransientError, type FetchLike } from "@/lib/llm/types";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

export type EmbeddingModelKind = "local" | "openai" | "google";

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  kind: EmbeddingModelKind;
  /** Dimensions actually produced; must match the column or the insert fails. */
  dimensions: number;
}

export interface EmbeddingConfig {
  kind: EmbeddingModelKind;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

// -------------------------------------------------------------------------
// Local deterministic embedder
// -------------------------------------------------------------------------

/**
 * 32-bit FNV-1a. Chosen over a cryptographic hash because it is short,
 * dependency-free, and stable across Node versions — the vectors it produces
 * must be reproducible, or every re-ingest would invalidate the corpus.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/**
 * Word-level tokens. Handles Latin and Arabic-script text: Persian and Arabic
 * have no uppercase/lowercase distinction and join letters, so lowercasing is
 * a no-op there and the character class is what actually matters.
 */
function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      // Strip zero-width joiners, which are pervasive in Persian and would
      // otherwise make two spellings of the same word different tokens.
      .replace(/[\u200c\u200d\u200e\u200f]/g, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/**
 * Bag-of-words hashed into a fixed-width vector, L2-normalised.
 *
 * Terms are also indexed by their character trigrams, which gives a little
 * fuzziness for Persian morphology (a word and its inflected form share
 * trigrams) without needing a stemmer.
 */
export function localEmbed(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Float64Array(dimensions);
  const tokens = tokenize(text);

  for (const token of tokens) {
    // Whole-token bucket, weighted more than any single trigram.
    const whole = fnv1a(token) % dimensions;
    vec[whole] += 2;

    for (let i = 0; i + 3 <= token.length; i += 1) {
      const tri = token.slice(i, i + 3);
      vec[fnv1a(tri) % dimensions] += 1;
    }
  }

  // L2-normalise so the vector works with cosine distance, which is what
  // pgvector's <=> operator computes.
  let norm = 0;
  for (let i = 0; i < dimensions; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);

  if (norm === 0) return Array.from(vec);

  const out = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i += 1) out[i] = vec[i] / norm;

  return out;
}

// -------------------------------------------------------------------------
// Remote embedders
// -------------------------------------------------------------------------

/**
 * Maps an HTTP status onto the error classes the LLM layer already uses, so
 * callers can catch one type for both chat and embeddings.
 *
 * The constructor is positional — (message, status, provider) — not an
 * options object, so the body is folded into the message where it is useful
 * for debugging rather than passed separately.
 */
function statusToError(status: number, provider: string): LlmError | LlmTransientError {
  if (status === 429 || status >= 500) {
    return new LlmTransientError(`Embedding service returned ${status}`, status, provider);
  }

  return new LlmError(
    status === 401 || status === 403
      ? "کلید API سرویس embedding معتبر نیست."
      : `سرویس embedding خطای ${status} برگرداند.`,
    status,
    provider,
  );
}

/**
 * Both remote embedders take the key as a separate, non-optional argument.
 * The public entry point narrows it first, so neither implementation has to
 * re-check for undefined or assert past the type system.
 */
async function embedOpenAi(
  texts: string[],
  config: EmbeddingConfig,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ vectors: number[][]; model: string }> {
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = config.model ?? "text-embedding-3-small";

  const res = await fetchImpl(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  const raw = await res.text();

  if (!res.ok) throw statusToError(res.status, "openai");

  const parsed = JSON.parse(raw) as { data?: { embedding: number[]; index: number }[] };

  if (!Array.isArray(parsed.data)) {
    throw new LlmError("پاسخ سرویس embedding فیلد data نداشت.");
  }

  // The API is not contractually ordered; sort by index rather than assuming.
  const ordered = [...parsed.data].sort((a, b) => a.index - b.index);

  return { vectors: ordered.map((d) => d.embedding), model };
}

async function embedGoogle(
  texts: string[],
  config: EmbeddingConfig,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ vectors: number[][]; model: string }> {
  const model = config.model ?? "text-embedding-004";
  const baseUrl = (config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");

  const res = await fetchImpl(
    `${baseUrl}/models/${model}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${model}`,
          content: { parts: [{ text: t }] },
        })),
      }),
    },
  );

  const raw = await res.text();

  if (!res.ok) throw statusToError(res.status, "google");

  const parsed = JSON.parse(raw) as { embeddings?: { values: number[] }[] };

  if (!Array.isArray(parsed.embeddings)) {
    throw new LlmError("پاسخ سرویس embedding فیلد embeddings نداشت.");
  }

  return { vectors: parsed.embeddings.map((e) => e.values), model };
}

// -------------------------------------------------------------------------
// Entry point
// -------------------------------------------------------------------------

/**
 * Embeds a batch of texts.
 *
 * Never throws for the local kind. Remote failures propagate as LlmError or
 * LlmTransientError so the caller can decide whether to retry or fall back.
 */
export async function embedTexts(
  texts: string[],
  config: EmbeddingConfig,
  fetchImpl: FetchLike = fetch,
): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { vectors: [], model: "local", kind: "local", dimensions: EMBEDDING_DIMENSIONS };
  }

  if (config.kind === "local" || !config.apiKey) {
    return {
      vectors: texts.map((t) => localEmbed(t)),
      model: "local-hash",
      kind: "local",
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }

  const apiKey = config.apiKey;

  const result =
    config.kind === "google"
      ? await embedGoogle(texts, config, apiKey, fetchImpl)
      : await embedOpenAi(texts, config, apiKey, fetchImpl);

  const dimensions = result.vectors[0]?.length ?? 0;

  // A model whose width does not match the column would fail the insert with
  // a confusing Postgres error. Say what is actually wrong instead.
  if (dimensions !== EMBEDDING_DIMENSIONS) {
    throw new LlmError(
      `مدل embedding بُعد ${dimensions} تولید کرد ولی ستون ${EMBEDDING_DIMENSIONS} است. ` +
        "یا مدل دیگری انتخاب کنید یا migration جدیدی برای این بُعد بنویسید.",
    );
  }

  return { ...result, kind: config.kind, dimensions };
}

/** Embeds a single string. Convenience wrapper around embedTexts. */
export async function embedText(
  text: string,
  config: EmbeddingConfig,
  fetchImpl: FetchLike = fetch,
): Promise<number[]> {
  const result = await embedTexts([text], config, fetchImpl);

  return result.vectors[0];
}
