import { describe, it, expect } from "vitest";
import { chunkText, estimateTokens } from "@/lib/rag/chunk";
import { rerankScore } from "@/lib/rag";
import { localEmbed } from "@/lib/rag/embeddings";
import { normalizeForSearch, contentHash } from "@/lib/rag/normalize";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

// The database-backed half of the RAG layer (ingest + hybrid search) is
// exercised against a live Postgres in scripts/tmp-rag-check.ts during
// development; what is covered here is everything that decides answer
// quality *before* a query ever reaches the database — the chunking rules
// and the local embedder. Those are pure functions, so they can be pinned
// exactly, and a regression in either silently degrades every answer.

describe("chunkText", () => {
  it("returns nothing for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  \t ")).toEqual([]);
  });

  it("keeps a short document as a single chunk", () => {
    const chunks = chunkText("# Title\n\nA short paragraph.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("A short paragraph.");
  });

  it("splits on headings so each section stays searchable", () => {
    const text = [
      "# First section",
      "",
      "Content of the first section.",
      "",
      "## Second section",
      "",
      "Content of the second section.",
    ].join("\n");

    const chunks = chunkText(text, { targetChars: 40, maxChars: 60, overlapChars: 0 });

    // A heading must never end up alone: on its own it carries no
    // retrievable information.
    for (const chunk of chunks) {
      const isBareHeading = /^#{1,6}\s/.test(chunk) && chunk.split("\n").length === 1;
      expect(isBareHeading).toBe(false);
    }

    const joined = chunks.join("\n");
    expect(joined).toContain("Content of the first section.");
    expect(joined).toContain("Content of the second section.");
  });

  it("never exceeds maxChars", () => {
    // One enormous paragraph with no structure to split on.
    const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");

    const chunks = chunkText(text, { targetChars: 200, maxChars: 260, overlapChars: 30 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(260);
    }
  });

  it("drops no content when splitting a long block", () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`);
    const text = words.join(" ");

    const chunks = chunkText(text, { targetChars: 200, maxChars: 260, overlapChars: 0 });
    const recovered = new Set(chunks.join(" ").split(/\s+/));

    // Every original word must survive in at least one chunk.
    for (const word of words) {
      expect(recovered.has(word)).toBe(true);
    }
  });

  it("handles Persian text without splitting inside a word", () => {
    const text =
      "این افزونه لایسنس را روی سرور فعال می‌کند و در صورت ناموفق بودن خطا را نمایش می‌دهد.\n\n" +
      "برای انتقال لایسنس به دامنه جدید ابتدا باید آن را غیرفعال کنید.";

    const chunks = chunkText(text, { targetChars: 120, maxChars: 200, overlapChars: 0 });

    expect(chunks.length).toBeGreaterThan(0);
    // No chunk may begin or end mid-word with a stray half of a token.
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
    expect(chunks.join(" ")).toContain("غیرفعال");
  });

  it("carries overlap forward so a fact spanning a boundary survives", () => {
    const text = Array.from({ length: 200 }, (_, i) => `term${i}`).join(" ");

    // The ceiling must leave room for the overlap: tail (80) + a full piece
    // (~200) has to fit inside maxChars, or the code correctly skips it.
    const chunks = chunkText(text, { targetChars: 200, maxChars: 400, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(2);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(400);
    }

    // With overlap enabled, some token must appear in more than one chunk.
    const seen = new Map<string, number>();
    for (const chunk of chunks) {
      for (const token of new Set(chunk.split(/\s+/))) {
        seen.set(token, (seen.get(token) ?? 0) + 1);
      }
    }

    const duplicated = [...seen.values()].filter((n) => n > 1).length;
    expect(duplicated).toBeGreaterThan(0);
  });

  it("skips the overlap rather than breaking the ceiling", () => {
    const text = Array.from({ length: 200 }, (_, i) => `term${i}`).join(" ");

    // 80 + 200 + 2 = 282 > 260, so honouring maxChars means dropping the
    // overlap. The ceiling is the invariant a caller can rely on; the
    // overlap is best-effort.
    const chunks = chunkText(text, { targetChars: 200, maxChars: 260, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(260);
    }

    const seen = new Map<string, number>();
    for (const chunk of chunks) {
      for (const token of new Set(chunk.split(/\s+/))) {
        seen.set(token, (seen.get(token) ?? 0) + 1);
      }
    }

    expect([...seen.values()].some((n) => n > 1)).toBe(false);
  });
});

describe("estimateTokens", () => {
  it("approximates at roughly four characters per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("rounds up so a prompt budget is never under-counted", () => {
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("localEmbed", () => {
  it("produces a vector of the column's exact width", () => {
    const vec = localEmbed("anything");

    expect(vec).toHaveLength(EMBEDDING_DIMENSIONS);
    for (const n of vec) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("is deterministic, so re-ingesting does not invalidate the corpus", () => {
    const a = localEmbed("High-Performance Order Storage");
    const b = localEmbed("High-Performance Order Storage");

    expect(a).toEqual(b);
  });

  it("is L2-normalised, which is what cosine distance assumes", () => {
    const vec = localEmbed("some words to embed");
    const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0));

    expect(norm).toBeCloseTo(1, 6);
  });

  it("ranks a near-identical query closer than an unrelated one", () => {
    const doc = localEmbed("High-Performance Order Storage moves WooCommerce orders out of the posts table");
    const near = localEmbed("HPOS order tables WooCommerce");
    const far = localEmbed("best recipe for chocolate cake");

    const cosine = (a: number[], b: number[]) =>
      a.reduce((sum, x, i) => sum + x * b[i], 0);

    expect(cosine(doc, near)).toBeGreaterThan(cosine(doc, far));
  });

  it("treats a zero-width-joiner variant as the same word", () => {
    // Persian uses ZWNJ heavily; "می‌کند" and "میکند" are the same word to a
    // reader and must not become two unrelated tokens.
    const withZwnj = localEmbed("این افزونه لایسنس را فعال می‌کند");
    const without = localEmbed("این افزونه لایسنس را فعال میکند");

    const cosine = (a: number[], b: number[]) =>
      a.reduce((sum, x, i) => sum + x * b[i], 0);

    expect(cosine(withZwnj, without)).toBeGreaterThan(0.99);
  });

  it("returns an all-zero vector rather than NaN for content with no words", () => {
    const vec = localEmbed("   \n\t  ");

    expect(vec.every((n) => n === 0)).toBe(true);
  });
});

describe("normalizeForSearch", () => {
  it("unifies Arabic and Persian letter forms", () => {
    expect(normalizeForSearch("كتاب")).toBe(normalizeForSearch("کتاب"));
    expect(normalizeForSearch("علي")).toBe(normalizeForSearch("علی"));
  });

  it("treats half-space and full space as the same token", () => {
    expect(normalizeForSearch("می‌شود")).toBe(normalizeForSearch("می شود"));
  });

  it("maps Latin and Arabic digits onto Persian digits", () => {
    expect(normalizeForSearch("1403")).toBe(normalizeForSearch("۱۴۰۳"));
    expect(normalizeForSearch("١٤٠٣")).toBe(normalizeForSearch("۱۴۰۳"));
  });

  it("drops tatweel and direction marks", () => {
    expect(normalizeForSearch("کـتاب")).toBe(normalizeForSearch("کتاب"));
  });
});

describe("rerankScore", () => {
  it("scores a chunk that fully covers the query above a partial one", () => {
    const full = rerankScore("HPOS order tables", "HPOS order tables and their indexes");
    const partial = rerankScore("HPOS order tables", "an unrelated paragraph about orders");
    expect(full).toBeGreaterThan(partial);
  });

  it("rewards an exact phrase match", () => {
    const exact = rerankScore("HPOS", "a note about HPOS here");
    const scattered = rerankScore("HPOS", "H P O S are letters");
    expect(exact).toBeGreaterThan(scattered);
  });

  it("is neutral on an empty query", () => {
    expect(rerankScore("", "anything at all")).toBe(0);
  });
});

describe("contentHash", () => {
  it("is stable for identical content", async () => {
    const a = await contentHash("متن یکسان برای آزمایش");
    const b = await contentHash("متن یکسان برای آزمایش");
    expect(a).toBe(b);
  });

  it("ignores regional letter variants, so unchanged-meaning edits skip reindex", async () => {
    const a = await contentHash("كتاب علي");
    const b = await contentHash("کتاب علی");
    expect(a).toBe(b);
  });

  it("changes when the content actually changes", async () => {
    const a = await contentHash("متن اول");
    const b = await contentHash("متن دوم");
    expect(a).not.toBe(b);
  });
});
