/**
 * Documentation crawler for the knowledge base.
 *
 * The factory's answers are only as good as what it has read. This pulls
 * WordPress / WooCommerce developer documentation into kb_documents through
 * the same ingestDocument() path as a manual upload, so a crawled page and a
 * pasted page are indistinguishable to retrieval — and get the same
 * normalisation, structural chunking and hash-based incremental skip.
 *
 * Two rules matter more than speed here:
 *
 *   1. Be polite. We honour robots.txt, crawl one page at a time with a
 *      delay, and set an honest User-Agent. A crawler that gets the platform
 *      IP-banned from developer.wordpress.org is worse than no crawler.
 *   2. Be offline-testable. Every network touch goes through an injected
 *      `fetchImpl` and `sleep`, so the whole pipeline — robots, extraction,
 *      rate limiting, ingest — is unit-tested with no network and no keys.
 *
 * HTML is reduced to markdown-flavoured text rather than kept as HTML: the
 * structural chunker keys off headings, so <h1>..<h6> become "#", "##"… and
 * everything else collapses to clean paragraphs. Scripts, styles, nav and
 * chrome are dropped — they are noise that would otherwise be embedded.
 */

import { ingestDocument } from "./index";
import type { EmbeddingConfig } from "./embeddings";

export type FetchLike = typeof fetch;

export interface CrawlSource {
  /** Where the document is filed in the KB. */
  sourceKind: "DOCS" | "SUPPORT" | "MARKETPLACE" | "CHANGELOG" | "CODE";
  /** The page to fetch. */
  url: string;
}

export interface CrawlOptions {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Politeness delay between page fetches, in ms. */
  delayMs?: number;
  /** Hard cap so a runaway seed list cannot crawl forever. */
  maxPages?: number;
  /** Per-request timeout, ms. */
  timeoutMs?: number;
  /** Embedding config forwarded to ingestDocument. */
  embeddingConfig?: EmbeddingConfig;
  /** Called per page so an operator can watch progress. */
  onProgress?: (event: CrawlEvent) => void;
}

export type CrawlEvent =
  | { type: "fetch"; url: string }
  | { type: "ingest"; url: string; title: string; chunks: number; skipped: boolean }
  | { type: "skip"; url: string; reason: string }
  | { type: "error"; url: string; message: string };

export interface CrawlResult {
  fetched: number;
  ingested: number;
  /** Documents whose content hash was unchanged, so nothing was re-embedded. */
  skipped: number;
  failed: number;
  /** URLs blocked by robots.txt. */
  disallowed: number;
}

const DEFAULT_DELAY_MS = 1_000;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "AiWp-DocsBot/1.0 (+https://ansari.ai; knowledge-base crawler; respects robots.txt)";

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Parses a robots.txt body into the Disallow paths that apply to us.
 *
 * Deliberately simple: we match the `*` group and our own agent name, and
 * only understand Disallow (not Allow re-ordering or crawl-delay). That is
 * enough to stay out of the parts of a docs site that ask crawlers to stay
 * out, without shipping a full robots parser.
 */
export function parseRobots(body: string, userAgent = USER_AGENT): string[] {
  const disallow: string[] = [];
  let appliesToUs = false;
  const agentToken = userAgent.split("/")[0].toLowerCase();

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line.length === 0) continue;

    const [fieldRaw, ...rest] = line.split(":");
    const field = fieldRaw.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      const token = value.toLowerCase();
      appliesToUs = token === "*" || token === agentToken || agentToken.startsWith(token);
    } else if (field === "disallow" && appliesToUs && value.length > 0) {
      disallow.push(value);
    }
  }

  return disallow;
}

/** True when `pathname` is excluded by any Disallow rule. */
export function isDisallowed(pathname: string, rules: string[]): boolean {
  return rules.some((rule) => pathname === rule || pathname.startsWith(rule));
}

/** Decodes the handful of entities documentation pages actually use. */
function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Reduces an HTML document to clean, heading-structured plain text.
 *
 * Headings survive as markdown ("# H1", "## H2"…) because the structural
 * chunker uses them to keep a section with its title. Everything decorative
 * is removed so embeddings see prose, not navigation.
 */
export function htmlToText(html: string): { title: string; text: string } {
  // Drop the parts that are never content.
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = decodeEntities(
    (h1Match?.[1] ?? titleMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim(),
  );

  // Headings -> markdown, preserving level.
  body = body.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, inner) => {
    const clean = decodeEntities(inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return clean.length > 0 ? `\n\n${"#".repeat(Number(level))} ${clean}\n\n` : "\n";
  });

  // Block-level elements become paragraph breaks.
  body = body
    .replace(/<\/(p|div|section|article|li|tr|blockquote|pre|ul|ol|table)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ");

  // Strip every remaining tag, then decode and collapse whitespace.
  const text = decodeEntities(body.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();

  return { title, text };
}

/** Pulls every <loc> out of a sitemap XML body. */
export function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const url = decodeEntities(m[1]).trim();
    if (url.length > 0) urls.push(url);
  }
  return urls;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crawls a list of documentation URLs into the knowledge base.
 *
 * Robots.txt is fetched once per origin and cached for the run. Pages are
 * fetched serially with a politeness delay; each one is reduced to text and
 * ingested, where an unchanged content hash makes re-ingest a no-op. The
 * whole run is bounded by maxPages so a bad seed list cannot crawl forever.
 */
export async function crawlSources(
  sources: CrawlSource[],
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? realSleep;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const embeddingConfig = options.embeddingConfig ?? { kind: "local" };
  const onProgress = options.onProgress ?? (() => {});

  const result: CrawlResult = {
    fetched: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
    disallowed: 0,
  };

  // robots.txt per origin, fetched lazily and cached for the run.
  const robotsCache = new Map<string, string[]>();

  const robotsFor = async (origin: string): Promise<string[]> => {
    const cached = robotsCache.get(origin);
    if (cached) return cached;

    let rules: string[] = [];
    try {
      const res = await fetchWithTimeout(fetchImpl, `${origin}/robots.txt`, timeoutMs);
      if (res.ok) {
        rules = parseRobots(await res.text());
      }
    } catch {
      // An unreadable robots.txt is treated as "nothing disallowed" — the
      // polite default is to not crawl where we are told not to, but a
      // missing file is not a prohibition.
      rules = [];
    }
    robotsCache.set(origin, rules);
    return rules;
  };

  let processed = 0;

  for (const source of sources) {
    if (processed >= maxPages) break;
    processed += 1;

    let parsed: URL;
    try {
      parsed = new URL(source.url);
    } catch {
      onProgress({ type: "error", url: source.url, message: "آدرس نامعتبر است." });
      result.failed += 1;
      continue;
    }

    const rules = await robotsFor(parsed.origin);
    if (isDisallowed(parsed.pathname, rules)) {
      onProgress({ type: "skip", url: source.url, reason: "robots.txt" });
      result.disallowed += 1;
      continue;
    }

    onProgress({ type: "fetch", url: source.url });

    try {
      const res = await fetchWithTimeout(fetchImpl, source.url, timeoutMs);
      if (!res.ok) {
        onProgress({ type: "error", url: source.url, message: `HTTP ${res.status}` });
        result.failed += 1;
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const raw = await res.text();
      result.fetched += 1;

      const { title, text } = contentType.includes("xml")
        ? { title: source.url, text: raw }
        : htmlToText(raw);

      if (text.trim().length === 0) {
        onProgress({ type: "skip", url: source.url, reason: "بدون متن" });
        continue;
      }

      const ingested = await ingestDocument(
        {
          sourceKind: source.sourceKind,
          sourceKey: source.url,
          title: title || source.url,
          body: text,
          url: source.url,
        },
        embeddingConfig,
      );

      if (ingested.skipped) result.skipped += 1;
      else result.ingested += 1;

      onProgress({
        type: "ingest",
        url: source.url,
        title: ingested.skipped ? title || source.url : title || source.url,
        chunks: ingested.chunks,
        skipped: Boolean(ingested.skipped),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطای ناشناخته";
      onProgress({ type: "error", url: source.url, message });
      result.failed += 1;
    }

    // Politeness: never hammer the origin. The delay is skipped after the
    // last page so a small seed list does not pay for a trailing wait.
    if (processed < Math.min(sources.length, maxPages)) {
      await sleep(delayMs);
    }
  }

  return result;
}

/**
 * The seed documentation set the factory ships with.
 *
 * These are the canonical WordPress / WooCommerce developer references the
 * generated plugins actually touch — hooks, the plugin header, HPOS, the
 * Settings API and the REST API. Crawling them is what lets a small model
 * ground a generated module in the real API instead of inventing one.
 */
export const DEFAULT_DOC_SEEDS: readonly CrawlSource[] = [
  { sourceKind: "DOCS", url: "https://developer.wordpress.org/plugins/plugin-basics/header-requirements/" },
  { sourceKind: "DOCS", url: "https://developer.wordpress.org/plugins/settings/settings-api/" },
  { sourceKind: "DOCS", url: "https://developer.wordpress.org/apis/handbook/hooks/" },
  { sourceKind: "DOCS", url: "https://developer.wordpress.org/apis/handbook/rest-api/" },
  { sourceKind: "DOCS", url: "https://developer.wordpress.org/plugins/security/" },
  { sourceKind: "DOCS", url: "https://developer.woocommerce.com/document/high-performance-order-storage/" },
  { sourceKind: "DOCS", url: "https://developer.woocommerce.com/document/woocommerce-rest-api/" },
];
