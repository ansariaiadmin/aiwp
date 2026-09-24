/**
 * LLM provider contract.
 *
 * Mirrors src/lib/payment/types.ts on purpose: every driver takes an
 * injectable `fetch`, so request shaping, error mapping and retry behaviour
 * can be unit-tested with no network access and no API key
 * (see src/lib/__tests__/llm.test.ts). Production callers pass nothing and
 * get the global fetch.
 *
 * Security model: the API key is read from encrypted settings at call time
 * and is never logged, never returned to the client, and never embedded in
 * anything that reaches the browser. `getAiProviderConfigMasked()` is the
 * only accessor exposed through an API route.
 */

export type FetchLike = typeof fetch;

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  /** Optional override of the configured model. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Ask the provider for strict JSON. Used when the caller intends to parse
   * the output — e.g. turning a feature description into a plugin spec.
   */
  json?: boolean;
  /** Abort the call; wired to a per-request timeout by default. */
  signal?: AbortSignal;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  usage: LlmUsage | null;
  finishReason: string | null;
}

/**
 * Thrown for anything the caller cannot usefully retry: missing credentials,
 * a rejected request, provider-side refusals. Deliberately distinct from
 * LlmTransientError, which the retry wrapper handles on its own.
 */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** 429/5xx and network failures — safe to retry with backoff. */
export class LlmTransientError extends LlmError {
  constructor(message: string, status?: number, provider?: string) {
    super(message, status, provider);
    this.name = "LlmTransientError";
  }
}

export interface LlmModel {
  /** The provider's model identifier, sent on the wire. */
  id: string;
  label: string;
  /** Rough context window in tokens, used to pick a model for a task. */
  contextTokens: number;
  /** Whether the provider can be told to emit strict JSON. */
  supportsJson: boolean;
  /** Roughly how capable it is; higher is better. Used for routing. */
  capability: number;
  /** Relative cost weight; used to prefer a cheaper model when it suffices. */
  cost: number;
}

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  /** Models this provider can serve, for the admin UI and the router. */
  readonly models: readonly LlmModel[];
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export interface LlmProviderOptions {
  apiKey: string;
  /** Model configured in settings; used when the request does not override. */
  model: string;
  /** Endpoint override — required for `custom`, optional elsewhere. */
  baseUrl?: string | null;
  fetchImpl?: FetchLike;
  /** Milliseconds; defaults to LLM_TIMEOUT_MS. */
  timeoutMs?: number;
}
