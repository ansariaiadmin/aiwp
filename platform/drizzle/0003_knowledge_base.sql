CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."kb_source_kind" AS ENUM('DOCS', 'SUPPORT', 'MARKETPLACE', 'CHANGELOG', 'CODE', 'MANUAL');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_kind" "public"."kb_source_kind" NOT NULL,
	"source_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"embedding_model" text,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"last_ingested_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kb_documents_source_idx" ON "kb_documents" USING btree ("source_kind","source_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_documents_ingested_idx" ON "kb_documents" USING btree ("last_ingested_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kb_chunks_document_ordinal_idx" ON "kb_chunks" USING btree ("document_id","ordinal");
