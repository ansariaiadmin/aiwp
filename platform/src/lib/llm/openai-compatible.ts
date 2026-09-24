/**
 * OpenAI-compatible chat completions driver.
 *
 * One implementation covers four configurations because they all speak the
 * same wire protocol:
 *   - openai      (api.openai.com)
 *   - openrouter  (openrouter.ai, any model)
 *   - custom      (any self-hosted OpenAI-compatible endpoint, e.g. Qwen
 *                  behind vLLM / Ollama / llama.cpp)
 *
 * The API key is sent as a Bearer token and is never logged. Errors are
 * mapped onto LlmError (do not retry) and LlmTransientError (retryable) so
 * the wrapper in index.ts can apply backoff without inspecting HTTP codes.
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

/**
 * Catalogue of models the router knows about. `custom` endpoints get a
 * permissive entry: a self-hosted deployment may serve anything, so the
 * platform assumes the operator's stated model is capable and lets them
 * route explicitly rather than guessing wrong and refusing the task.
 */
const OPENAI_MODELS: readonly LlmModel[] = [
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    contextTokens: 1_000_000,
    supportsJson: true,
    capability: 3,
    cost: 3,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    contextTokens: 1_000_000,
    supportsJson: true,
    capability: 2,
    cost: 1,
  },
  {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    contextTokens: 1_000_000,
    supportsJson: true,
    capability: 1,
    cost: 1,
  },
];

const OPENROUTER_MODELS: readonly LlmModel[] = [
  {
    id: "openrouter/auto",
    label: "OpenRouter Auto",
    contextTokens: 128_000,
    supportsJson: true,
    capability: 3,
    cost: 2,
  },
];

const CUSTOM_MODELS: readonly LlmModel[] = [
  {
    id: "",
    label: "مدل مشخص‌شده در تنظیمات",
    contextTokens: 128_000,
    supportsJson: true,
    capability: 3,
    cost: 1,
  },
];

function defaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly models: readonly LlmModel[];

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: LlmProviderOptions, provider: string, label: string) {
    this.id = provider;
    this.label = label;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl || defaultBaseUrl(provider)).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.models =
      provider === "openrouter"
        ? OPENROUTER_MODELS
        : provider === "custom"
          ? // Report the configured model by name so the admin UI and the
            // router see a real identifier rather than an empty string.
            [{ ...CUSTOM_MODELS[0], id: options.model, label: options.model }]
          : OPENAI_MODELS;
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

    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) body.max_tokens = request.maxOutputTokens;

    if (request.json) {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    // An explicit caller signal still wins.
    request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new LlmTransientError(
        e instanceof Error && e.name === "AbortError"
          ? `فراخوانی مدل پس از ${this.timeoutMs}ms متوقف شد.`
          : `اتصال به سرویس‌دهنده‌ی مدل برقرار نشد: ${e instanceof Error ? e.message : String(e)}`,
        undefined,
        this.id,
      );
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text().catch(() => "");

    if (!res.ok) {
      // 401/403 are configuration problems; 400 is a malformed request.
      // 429 and 5xx are worth retrying.
      const transient = res.status === 429 || res.status >= 500;
      const detail = extractErrorMessage(raw) ?? `HTTP ${res.status}`;
      const message = `سرویس‌دهنده‌ی مدل خطا داد: ${detail}`;

      throw transient
        ? new LlmTransientError(message, res.status, this.id)
        : new LlmError(message, res.status, this.id);
    }

    return this.parseResponse(raw, model);
  }

  private parseResponse(raw: string, fallbackModel: string): LlmResponse {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new LlmError("پاسخ سرویس‌دهنده‌ی مدل JSON معتبر نبود.", undefined, this.id);
    }

    const choice = (data as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> })
      .choices?.[0];

    const text = choice?.message?.content;

    if (typeof text !== "string") {
      throw new LlmError("پاسخ سرویس‌دهنده‌ی مدل متن نداشت.", undefined, this.id);
    }

    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } })
      .usage;

    return {
      text,
      model: (data as { model?: string }).model ?? fallbackModel,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          }
        : null,
      finishReason: choice?.finish_reason ?? null,
    };
  }
}

/**
 * Provider error bodies vary ({error:{message}} on OpenAI, a bare
 * {message} elsewhere, sometimes plain text). Pull out whatever is
 * human-readable so the operator sees a reason, not just a status code.
 */
function extractErrorMessage(raw: string): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };
    return parsed.error?.message ?? parsed.message ?? parsed.detail ?? null;
  } catch {
    return raw.slice(0, 200);
  }
}
