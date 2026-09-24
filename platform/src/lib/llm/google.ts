/**
 * Google Gemini generateContent driver.
 *
 * Gemini differs from both OpenAI and Anthropic: the model is part of the
 * URL path, the API key is a query parameter rather than a header, roles are
 * "user"/"model" rather than "user"/"assistant", and the response nests text
 * inside candidates[].content.parts[].
 */

import {
  LlmError,
  LlmTransientError,
  type FetchLike,
  type LlmModel,
  type LlmProvider,
  type LlmProviderOptions,
  type LlmRequest,
  type LlmResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const MODELS: readonly LlmModel[] = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    contextTokens: 1_000_000,
    supportsJson: true,
    capability: 3,
    cost: 3,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    contextTokens: 1_000_000,
    supportsJson: true,
    capability: 2,
    cost: 1,
  },
];

export class GoogleProvider implements LlmProvider {
  readonly id = "google";
  readonly label = "Google Gemini";
  readonly models = MODELS;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: LlmProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model || this.model;

    if (!model) {
      throw new LlmError(
        "مدلی برای فراخوانی مشخص نشده است. در تنظیمات هوش مصنوعی یک مدل وارد کنید.",
        undefined,
        this.id,
      );
    }

    // Gemini folds the system prompt into a separate field and expects
    // "model" rather than "assistant" for its own turns.
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      throw new LlmError("دست‌کم یک پیام غیر از system لازم است.", undefined, this.id);
    }

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = request.maxOutputTokens;
    if (request.json) generationConfig.responseMimeType = "application/json";

    const body: Record<string, unknown> = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    // The key goes in the query string; keep it out of any logged URL by
    // building the string once and never echoing it back.
    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new LlmTransientError(
        e instanceof Error && e.name === "AbortError"
          ? `فراخوانی مدل پس از ${this.timeoutMs}ms متوقف شد.`
          : `اتصال به Gemini برقرار نشد: ${e instanceof Error ? e.message : String(e)}`,
        undefined,
        this.id,
      );
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text().catch(() => "");

    if (!res.ok) {
      const transient = res.status === 429 || res.status >= 500;
      const message = `Gemini خطا داد: ${extractError(raw) ?? `HTTP ${res.status}`}`;
      throw transient
        ? new LlmTransientError(message, res.status, this.id)
        : new LlmError(message, res.status, this.id);
    }

    return this.parse(raw, model);
  }

  private parse(raw: string, fallbackModel: string): LlmResponse {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new LlmError("پاسخ Gemini با JSON معتبر نبود.", undefined, this.id);
    }

    const parsed = data as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const candidate = parsed.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");

    if (!text) {
      throw new LlmError("پاسخ Gemini متن نداشت.", undefined, this.id);
    }

    const usage = parsed.usageMetadata;

    return {
      text,
      model: fallbackModel,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          }
        : null,
      finishReason: candidate?.finishReason ?? null,
    };
  }
}

function extractError(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? null;
  } catch {
    return raw.slice(0, 200);
  }
}
