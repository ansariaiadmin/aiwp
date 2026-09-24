-- Retrieval uses a normalised copy of each chunk so that regional letter
-- variants ("ي/ی", "ك/ک"), half-space/full-space and digit forms all match,
-- while kb_chunks.content stays verbatim for display and citation.
--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD COLUMN IF NOT EXISTS "search_text" text;
--> statement-breakpoint
-- Stable hash of the normalised body; lets re-ingest skip re-embedding an
-- unchanged document (incremental indexing).
ALTER TABLE "kb_documents" ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint
-- The embedding model that produced the current vectors, so a model swap is
-- detectable and can trigger a controlled reindex instead of silently mixing
-- incompatible vectors.
ALTER TABLE "kb_documents" ADD COLUMN IF NOT EXISTS "indexed_embedding_model" text;
--> statement-breakpoint
-- Backfill so pre-existing rows are searchable; they are normalised properly
-- on the next ingest/reindex.
UPDATE "kb_chunks" SET "search_text" = "content" WHERE "search_text" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_chunks_search_idx" ON "kb_chunks" USING gin (to_tsvector('simple', "search_text"));
