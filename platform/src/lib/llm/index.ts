/**
 * Resolves the configured LLM provider and exposes one entry point.
 *
 * Follows src/lib/payment/index.ts deliberately, including the rule that
 * matters most: when a provider is selected but its key is missing, the call
 * fails loudly instead of quietly degrading. A background job that silently
 * produced empty output would corrupt generated plugins in a way nobody
 * notices until a customer does.
 */

import { getAiProviderConfig, type AiProviderConfig } from "@/lib/settings";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { OpenAiCompatibleProvider } from "./openai-compatible";
import {
  LlmError,
  LlmTransientError,
  type FetchLike,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./types";

export { CAPABILITY, TASKS, routeModel, type TaskId, type TaskRequirements } from "./profiles";
export {
  LlmError,
  LlmTransientError,
  type LlmMessage,
  type LlmModel,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
} from "./types";

const DEFAULT_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

/**
 * Builds a provider from a resolved config. Split from getProvider() so tests
 * can construct any provider without touching the database.
 */
export function resolveProvider(
  config: AiProviderConfig,
  fetchImpl?: FetchLike,
): LlmProvider {
  const options = {
    apiKey: config.apiKey ?? "",
    model: config.model,
    baseUrl: config.baseUrl,
    fetchImpl,
  };

  switch (config.provider) {
    case "anthropic":
      if (!config.apiKey) {
        throw new LlmError(
          "Anthropic انتخاب شده ولی کلید API در تنظیمات هوش مصنوعی وارد نشده است.",
        );
      }
      return new AnthropicProvider(options);

    case "google":
      if (!config.apiKey) {
        throw new LlmError(
          "Google Gemini انتخاب شده ولی کلید API در تنظیمات هوش مصنوعی وارد نشده است.",
        );
      }
      return new GoogleProvider(options);

    case "openai":
    case "openrouter":
    case "custom":
      if (!config.apiKey) {
        throw new LlmError(
          "سرویس‌دهنده‌ی مدل انتخاب شده ولی کلید API در تنظیمات هوش مصنوعی وارد نشده است.",
        );
      }
      if (config.provider === "custom" && !config.baseUrl) {
        throw new LlmError(
          "حالت سفارشی انتخاب شده ولی آدرس endpoint وارد نشده است.",
        );
      }
      if (!config.model) {
        throw new LlmError(
          "برای این سرویس‌دهنده باید نام مدل را در تنظیمات وارد کنید.",
        );
      }
      return new OpenAiCompatibleProvider(
        options,
        config.provider,
        config.provider === "openai"
          ? "OpenAI"
          : config.provider === "openrouter"
            ? "OpenRouter"
            : "سفارشی",
      );

    default: {
      const exhaustive: never = config.provider;
      throw new LlmError(`سرویس‌دهنده‌ی ناشناخته: ${String(exhaustive)}`);
    }
  }
}

/** The provider the platform is currently configured to use. */
export async function getProvider(fetchImpl?: FetchLike): Promise<LlmProvider> {
  return resolveProvider(await getAiProviderConfig(), fetchImpl);
}

export interface CompleteOptions {
  fetchImpl?: FetchLike;
  /** Retries for transient failures only. Defaults to 2. */
  retries?: number;
  /** Called between attempts; useful for logging. */
  onRetry?: (attempt: number, error: LlmTransientError) => void;
  provider?: LlmProvider;
}

/**
 * Runs a completion with bounded retries and exponential backoff.
 *
 * Only LlmTransientError is retried. Anything else — a missing key, a 401, a
 * malformed request — is surfaced immediately, because repeating an
 * unconfigured request just burns time and rate limit.
 */
export async function complete(
  request: LlmRequest,
  options: CompleteOptions = {},
): Promise<LlmResponse> {
  const provider = options.provider ?? (await getProvider(options.fetchImpl));
  const retries = options.retries ?? DEFAULT_RETRIES;

  let lastError: LlmTransientError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await provider.complete(request);
    } catch (e) {
      if (!(e instanceof LlmTransientError)) throw e;

      lastError = e;

      if (attempt === retries) break;

      options.onRetry?.(attempt + 1, e);

      // Exponential with jitter, so a fleet of workers does not retry in
      // lockstep straight into the provider's rate limit.
      const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250);
      await sleep(delay);
    }
  }

  throw lastError ?? new LlmError("فراخوانی مدل ناموفق بود.", undefined, provider.id);
}

/**
 * Convenience wrapper for callers that need parsed JSON — e.g. turning a
 * feature description into a plugin spec.
 *
 * Tolerates the two things models actually do wrong: wrapping the object in
 * a ```json fence, and adding prose around it. Anything it cannot salvage is
 * reported as an LlmError rather than a confusing JSON.parse stack.
 */
export async function completeJson<T>(
  request: LlmRequest,
  options: CompleteOptions = {},
): Promise<T> {
  const response = await complete({ ...request, json: true }, options);
  return parseJsonLoose<T>(response.text);
}

export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();

  // Strip a markdown fence if present.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to the outermost balanced braces, which handles a model that
    // added a sentence of commentary.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        // fall through
      }
    }

    throw new LlmError("خروجی مدل JSON قابل تجزیه نبود.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
