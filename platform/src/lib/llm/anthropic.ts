/**
 * Anthropic Messages API driver.
 *
 * Anthropic does not speak the OpenAI wire protocol: the auth header is
 * x-api-key, the version header is mandatory, the system prompt is a
 * top-level field rather than a message, and the response nests text inside
 * a content array. Rather than shoehorn that into the OpenAI-compatible
 * driver it gets its own, small implementation.
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
const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

const MODELS: readonly LlmModel[] = [
  {
    id: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    contextTokens: 200_000,
    supportsJson: true,
    capability: 3,
    cost: 2,
  },
  {
    id: "claude-opus-4.1",
    label: "Claude Opus 4.1",
    contextTokens: 200_000,
    supportsJson: true,
    capability: 3,
    cost: 3,
  },
  {
    id: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    contextTokens: 200_000,
    supportsJson: true,
    capability: 2,
    cost: 1,
  },
];

export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic";
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

    // The system prompt is a top-level field, and the messages array must not
    // contain a system role.
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    if (messages.length === 0) {
      throw new LlmError("دست‌کم یک پیام غیر از system لازم است.", undefined, this.id);
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      // Anthropic requires max_tokens on every request.
      max_tokens: request.maxOutputTokens ?? 4096,
    };

    if (system) body.system = system;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.json) {
      // Anthropic has no JSON mode; instruct it instead and let the caller
      // parse defensively.
      body.system = [system, "Respond with a single valid JSON object and no prose."]
        .filter(Boolean)
        .join("\n\n");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new LlmTransientError(
        e instanceof Error && e.name === "AbortError"
          ? `فراخوانی مدل پس از ${this.timeoutMs}ms متوقف شد.`
          : `اتصال به Anthropic برقرار نشد: ${e instanceof Error ? e.message : String(e)}`,
        undefined,
        this.id,
      );
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text().catch(() => "");

    if (!res.ok) {
      const transient = res.status === 429 || res.status === 529 || res.status >= 500;
      const message = `Anthropic خطا داد: ${extractError(raw) ?? `HTTP ${res.status}`}`;
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
      throw new LlmError("پاسخ Anthropic با JSON معتبر نبود.", undefined, this.id);
    }

    const parsed = data as {
      model?: string;
      stop_reason?: string;
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (parsed.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");

    if (!text) {
      throw new LlmError("پاسخ Anthropic متن نداشت.", undefined, this.id);
    }

    const input = parsed.usage?.input_tokens ?? 0;
    const output = parsed.usage?.output_tokens ?? 0;

    return {
      text,
      model: parsed.model ?? fallbackModel,
      usage: parsed.usage ? { promptTokens: input, completionTokens: output, totalTokens: input + output } : null,
      finishReason: parsed.stop_reason ?? null,
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
