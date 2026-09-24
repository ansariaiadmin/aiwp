import { describe, it, expect, vi, beforeEach } from "vitest";

// The crawler's only side effect is ingestDocument(); the database-backed
// half of the RAG layer is exercised against live Postgres elsewhere (see
// scripts/tmp-rag-check.ts and the live API checks). Here we mock ingest so
// the crawler's own logic — robots, extraction, rate limiting, and the
// propagate-skipped path — is pinned with no database and no network.
const ingestCalls: Array<{ sourceKey: string }> = [];
vi.mock("@/lib/rag", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rag")>("@/lib/rag");
  return {
    ...actual,
    ingestDocument: vi.fn(async (input: { sourceKey: string }) => {
      const seen = ingestCalls.some((c) => c.sourceKey === input.sourceKey);
      ingestCalls.push({ sourceKey: input.sourceKey });
      return seen
        ? { documentId: "doc", chunks: 0, embeddingModel: "local-hash", embeddingKind: "local", skipped: true }
        : { documentId: "doc", chunks: 2, embeddingModel: "local-hash", embeddingKind: "local" };
    }),
  };
});

import {
  htmlToText,
  extractSitemapUrls,
  parseRobots,
  isDisallowed,
  crawlSources,
} from "@/lib/rag/crawler";

describe("htmlToText", () => {
  it("drops scripts, styles and navigation, keeping prose", () => {
    const html = `
      <html><head><style>.x{color:red}</style><title>Doc Title</title></head>
      <body>
        <nav><a href="/">Home</a><a href="/x">Other</a></nav>
        <h1>Real Heading</h1>
        <script>var tracking = 1;</script>
        <p>The Settings API registers settings safely.</p>
      </body></html>`;
    const { title, text } = htmlToText(html);

    expect(title).toBe("Real Heading");
    expect(text).toContain("The Settings API registers settings safely.");
    expect(text).not.toContain("tracking");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Home");
  });

  it("turns headings into markdown so the structural chunker keeps them", () => {
    const { text } = htmlToText("<h1>Top</h1><p>a</p><h2>Sub</h2><p>b</p>");
    expect(text).toContain("# Top");
    expect(text).toContain("## Sub");
  });

  it("decodes the entities documentation pages use", () => {
    const { text } = htmlToText("<p>a &amp; b &lt;tag&gt; &#39;quote&#39;</p>");
    expect(text).toContain("a & b <tag> 'quote'");
  });
});

describe("extractSitemapUrls", () => {
  it("pulls every loc out of a sitemap", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.com/a</loc></url>
      <url><loc>https://example.com/b</loc></url>
    </urlset>`;
    expect(extractSitemapUrls(xml)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });
});

describe("robots", () => {
  it("reads Disallow rules that apply to us", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private/\nDisallow: /tmp\n");
    expect(isDisallowed("/private/page", rules)).toBe(true);
    expect(isDisallowed("/public/page", rules)).toBe(false);
  });

  it("ignores rules for other agents", () => {
    const rules = parseRobots("User-agent: Googlebot\nDisallow: /\n");
    expect(isDisallowed("/anything", rules)).toBe(false);
  });
});

describe("crawlSources", () => {
  beforeEach(() => {
    ingestCalls.length = 0;
  });

  // A fake origin: robots allows /docs, the page is a tiny HTML article.
  const fakeFetch = (async (url: string) => {
    if (url.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nDisallow: /blocked/\n", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    if (url.includes("/blocked/")) {
      return new Response("should not be fetched", { status: 200 });
    }
    return new Response(
      "<html><head><title>T</title></head><body><h1>Register Settings</h1>" +
        "<p>Use register_setting to add an option.</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as unknown as typeof fetch;

  const noSleep = async () => {};

  it("ingests an allowed page and reports it", async () => {
    const result = await crawlSources(
      [{ sourceKind: "DOCS", url: "https://docs.test/register-settings" }],
      { fetchImpl: fakeFetch, sleep: noSleep, delayMs: 0 },
    );

    expect(result.fetched).toBe(1);
    expect(result.ingested).toBe(1);
    expect(result.failed).toBe(0);
    expect(ingestCalls[0].sourceKey).toBe("https://docs.test/register-settings");
  });

  it("honours robots.txt and does not fetch a disallowed path", async () => {
    const result = await crawlSources(
      [{ sourceKind: "DOCS", url: "https://docs.test/blocked/secret" }],
      { fetchImpl: fakeFetch, sleep: noSleep, delayMs: 0 },
    );

    expect(result.disallowed).toBe(1);
    expect(result.fetched).toBe(0);
  });

  it("propagates the incremental skip when the same page is crawled again", async () => {
    const source = { sourceKind: "DOCS" as const, url: "https://docs.test/incremental" };

    await crawlSources([source], { fetchImpl: fakeFetch, sleep: noSleep, delayMs: 0 });
    const second = await crawlSources([source], {
      fetchImpl: fakeFetch,
      sleep: noSleep,
      delayMs: 0,
    });

    // ingestDocument reports skipped on the repeat, and the crawler surfaces it.
    expect(second.skipped).toBe(1);
    expect(second.ingested).toBe(0);
  });

  it("records a failure without throwing when a page 404s", async () => {
    const failing = (async () =>
      new Response("nope", { status: 404 })) as unknown as typeof fetch;

    const result = await crawlSources(
      [{ sourceKind: "DOCS", url: "https://docs.test/missing" }],
      { fetchImpl: failing, sleep: noSleep, delayMs: 0 },
    );

    expect(result.failed).toBe(1);
  });

  it("stops at maxPages so a runaway seed list cannot crawl forever", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      sourceKind: "DOCS" as const,
      url: `https://docs.test/page-${i}`,
    }));

    const result = await crawlSources(many, {
      fetchImpl: fakeFetch,
      sleep: noSleep,
      delayMs: 0,
      maxPages: 3,
    });

    expect(result.fetched).toBe(3);
  });
});
