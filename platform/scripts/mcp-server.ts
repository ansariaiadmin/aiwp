#!/usr/bin/env -S npx tsx
/**
 * AiWp MCP server.
 *
 * Exposes the platform's own capabilities to any MCP client (Claude Desktop,
 * Cursor, an agent runtime) over stdio — the transport MCP clients expect for
 * a locally-spawned server.
 *
 *   npx tsx scripts/mcp-server.ts
 *
 * "Dynamic" means two concrete things here, and both matter:
 *
 *   1. The tool list is *derived*, not hardcoded. `list_modules` and the
 *      module enum used by `draft_spec` are generated from MODULE_CATALOGUE
 *      at startup, so adding a module to the factory makes it visible to
 *      every connected client without editing this file. A static tool list
 *      is how an MCP server ends up advertising a module the composer will
 *      then reject.
 *   2. `refresh` re-reads the catalogue and the corpus and re-announces the
 *      changed tool list, so a long-lived client sees a newly-ingested
 *      corpus or a newly-added module without reconnecting.
 *
 * Everything is read-mostly by design. The one write (`ingest_document`)
 * goes through the same ingest path the admin API uses, so there is exactly
 * one place that knows how to chunk and embed.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  MODULE_CATALOGUE,
  MODULE_IDS,
  catalogueForPrompt,
} from "../src/lib/ai/module-catalogue";
import {
  ingestDocument,
  searchKnowledge,
  knowledgeStats,
  reindexAll,
  buildContext,
  type KbSourceKind,
} from "../src/lib/rag";
import { crawlSources, DEFAULT_DOC_SEEDS } from "../src/lib/rag/crawler";
import { recordLesson, reviewAndLearn } from "../src/lib/ai/lessons";
import { QUALITY_RULES } from "../src/lib/ai/rules";
import { draftedSpecSchema } from "../src/lib/validation/ai";

const SOURCE_KINDS = ["DOCS", "SUPPORT", "MARKETPLACE", "CHANGELOG", "CODE", "MANUAL"] as const;

/** MCP tool results are a list of typed content blocks. */
function text(content: string, isError = false) {
  return { content: [{ type: "text" as const, text: content }], isError };
}

function json(value: unknown) {
  return text(JSON.stringify(value, null, 2));
}

const server = new McpServer(
  { name: "aiwp", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
    instructions:
      "Tools for the AiWp WordPress plugin factory. Use list_modules before " +
      "drafting a spec — only those module ids are valid. Use search_knowledge " +
      "to ground answers in the indexed documentation rather than guessing.",
  },
);

// -------------------------------------------------------------------------
// Knowledge base
// -------------------------------------------------------------------------

server.registerTool(
  "search_knowledge",
  {
    title: "Search the knowledge base",
    description:
      "Hybrid (keyword + vector) search over the indexed documentation corpus. " +
      "Returns nothing rather than low-confidence matches when the corpus has " +
      "no relevant content, so an empty result means 'not indexed', not 'search failed'.",
    inputSchema: {
      query: z.string().min(1).describe("Natural-language question or keywords"),
      limit: z.number().int().min(1).max(25).optional().describe("Maximum chunks to return"),
      sourceKinds: z
        .array(z.enum(SOURCE_KINDS))
        .optional()
        .describe("Restrict to specific source kinds"),
    },
  },
  async ({ query, limit, sourceKinds }) => {
    const results = await searchKnowledge(query, {
      limit: limit ?? 8,
      sourceKinds: sourceKinds as KbSourceKind[] | undefined,
    });

    if (results.length === 0) {
      return text(
        "No relevant content in the knowledge base for that query. " +
          "This is a relevance cutoff, not an error — the corpus may simply not cover it.",
      );
    }

    const { context, usedTokens } = buildContext(results, 4000);

    return text(
      `${results.length} chunk(s), ~${usedTokens} tokens:\n\n${context}\n\n` +
        `---\nSources:\n${results
          .map((r, i) => `[${i + 1}] ${r.title}${r.url ? ` — ${r.url}` : ""} (via ${r.matchedBy.join("+")})`)
          .join("\n")}`,
    );
  },
);

server.registerTool(
  "ingest_document",
  {
    title: "Add a document to the knowledge base",
    description:
      "Chunks and embeds a document, replacing any existing document with the " +
      "same (sourceKind, sourceKey). Safe to call repeatedly.",
    inputSchema: {
      sourceKind: z.enum(SOURCE_KINDS),
      sourceKey: z.string().min(1).describe("Stable identity, e.g. a URL or file path"),
      title: z.string().min(1),
      body: z.string().min(1),
      url: z.string().url().optional(),
    },
  },
  async (input) => {
    const result = await ingestDocument({
      sourceKind: input.sourceKind as KbSourceKind,
      sourceKey: input.sourceKey,
      title: input.title,
      body: input.body,
      url: input.url,
    });

    return json({
      documentId: result.documentId,
      chunks: result.chunks,
      embeddingModel: result.embeddingModel,
      note:
        result.embeddingKind === "local"
          ? "Embedded with the local hash embedder (no API key configured). Keyword-weighted only — configure a real embedding model in admin settings for semantic search."
          : undefined,
    });
  },
);

server.registerTool(
  "corpus_stats",
  {
    title: "Knowledge base statistics",
    description: "Document and chunk counts, how many chunks are embedded, and which model embedded them.",
    inputSchema: {},
  },
  async () => json(await knowledgeStats()),
);

// -------------------------------------------------------------------------
// Factory — derived from the live module catalogue
// -------------------------------------------------------------------------

server.registerTool(
  "list_modules",
  {
    title: "List factory modules",
    description:
      "Every module the composer can assemble, with its dependencies. " +
      "Only these ids are valid in a spec — do not invent others.",
    inputSchema: {},
  },
  async () => json(MODULE_CATALOGUE),
);

server.registerTool(
  "draft_spec",
  {
    title: "Draft a plugin specification",
    description:
      "Validates a proposed plugin spec against the factory's schema. " +
      "This does NOT call a model — it checks that a spec is buildable and " +
      "reports exactly which field is wrong, so an agent can self-correct " +
      "before handing the spec to the composer.",
    inputSchema: {
      slug: z.string(),
      name: z.string(),
      namespace: z.string(),
      prefix: z.string(),
      textDomain: z.string(),
      version: z.string().optional(),
      modules: z.array(z.string()),
      options: z
        .array(
          z.object({
            key: z.string(),
            type: z.string(),
            label: z.string(),
            default: z.union([z.string(), z.number(), z.boolean()]).optional(),
            tab: z.string().optional(),
          }),
        )
        .optional(),
      features: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const parsed = draftedSpecSchema.safeParse(input);

    if (!parsed.success) {
      const problems = parsed.error.issues.map(
        (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
      );

      return text(
        `Spec is not buildable:\n${problems.join("\n")}\n\n` +
          `Valid module ids: ${MODULE_IDS.join(", ")}`,
        true,
      );
    }

    const unknown = parsed.data.modules.filter((m) => !MODULE_IDS.includes(m));

    if (unknown.length > 0) {
      return text(`Unknown module(s): ${unknown.join(", ")}\nValid: ${MODULE_IDS.join(", ")}`, true);
    }

    return json({
      valid: true,
      spec: parsed.data,
      moduleCatalogue: catalogueForPrompt(),
    });
  },
);

server.registerTool(
  "review_code",
  {
    title: "Review generated PHP and learn from its breaches",
    description:
      "Scans generated PHP against the strict quality ruleset. For every " +
      "rule breached it logs a measurable violation event and writes the " +
      "correction back into the knowledge base as a lesson, so the next " +
      "draft is grounded in the fix. Returns the breaches and how many " +
      "lessons were recorded. clean=true means no detector-signature breach.",
    inputSchema: {
      code: z.string().describe("The generated PHP to review"),
      context: z.string().optional(),
    },
  },
  async ({ code, context }) => json(await reviewAndLearn(code, { context })),
);

server.registerTool(
  "record_lesson",
  {
    title: "Record a correction so the agent learns it",
    description:
      "Writes a caught violation and its fix back into the knowledge base, " +
      "keyed to the rule. The next time a similar feature is drafted, " +
      "grounding surfaces this lesson, so the same mistake becomes less " +
      "likely. One lesson is kept per rule. ruleId must be one of the " +
      "quality-rule ids.",
    inputSchema: {
      ruleId: z.enum(QUALITY_RULES.map((r) => r.id) as [string, ...string[]]),
      problem: z.string().describe("What the generated code did wrong"),
      fix: z.string().describe("The correction that fixed it"),
      context: z.string().optional(),
    },
  },
  async (input) => json(await recordLesson(input, { kind: "local" })),
);

server.registerTool(
  "crawl_docs",
  {
    title: "Crawl documentation into the knowledge base",
    description:
      "Fetches documentation pages and ingests them. With no urls it crawls " +
      "the shipped WordPress / WooCommerce seed set. Robots.txt is honoured " +
      "and unchanged pages are skipped by hash, so re-running is cheap. " +
      "Returns counts of fetched / ingested / skipped / failed / disallowed.",
    inputSchema: {
      urls: z
        .array(z.string())
        .optional()
        .describe("Explicit page URLs to crawl; omit for the default seed set"),
      maxPages: z.number().min(1).max(100).optional(),
    },
  },
  async ({ urls, maxPages }) => {
    const sources =
      urls && urls.length > 0
        ? urls.map((url) => ({ sourceKind: "DOCS" as const, url }))
        : [...DEFAULT_DOC_SEEDS];

    return json(
      await crawlSources(sources, {
        embeddingConfig: { kind: "local" },
        maxPages: maxPages ?? 50,
      }),
    );
  },
);

server.registerTool(
  "reindex",
  {
    title: "Re-embed the corpus",
    description:
      "Re-embeds documents whose stored embedding model differs from the " +
      "current one, or all of them with force=true. Use after changing the " +
      "embedding model so vectors from different models are never ranked " +
      "together. Returns how many documents were reindexed vs skipped.",
    inputSchema: {
      force: z.boolean().optional().describe("Re-embed even up-to-date documents"),
    },
  },
  async ({ force }) => json(await reindexAll({ kind: "local" }, Boolean(force))),
);

server.registerTool(
  "refresh",
  {
    title: "Re-announce tools and resources",
    description:
      "Re-reads the module catalogue and corpus, then notifies the client that " +
      "the tool and resource lists changed. Call after ingesting documents or " +
      "adding a module to the factory.",
    inputSchema: {},
  },
  async () => {
    const stats = await knowledgeStats();

    // The SDK sends tools/list_changed and resources/list_changed, which is
    // what makes a long-lived client pick up the new state without
    // reconnecting.
    await server.sendToolListChanged();
    await server.sendResourceListChanged();

    return json({ refreshed: true, ...stats });
  },
);

// -------------------------------------------------------------------------
// Resources: the corpus, exposed so a client can browse it directly
// -------------------------------------------------------------------------

server.registerResource(
  "corpus",
  "aiwp://corpus",
  {
    title: "Knowledge base corpus",
    description: "Statistics and module catalogue for the AiWp factory.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            stats: await knowledgeStats(),
            modules: MODULE_CATALOGUE,
          },
          null,
          2,
        ),
      },
    ],
  }),
);

// -------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Diagnostics go to stderr. stdout is the JSON-RPC channel, so a stray
  // console.log there corrupts every message in the session.
  console.error("[aiwp-mcp] connected over stdio");
}

// Wrapped in main() rather than using a top-level await: this file is loaded
// as CJS by tsx, where top-level await is a transform error and the server
// dies before it can answer the handshake.
main().catch((error) => {
  console.error("[aiwp-mcp] fatal:", error);
  process.exit(1);
});
