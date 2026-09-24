import { describe, expect, it } from "vitest";
import {
  complete,
  completeJson,
  parseJsonLoose,
  resolveProvider,
  LlmError,
  LlmTransientError,
} from "@/lib/llm";
import { CAPABILITY, routeModel, TASKS } from "@/lib/llm/profiles";
import { OpenAiCompatibleProvider } from "@/lib/llm/openai-compatible";
import { AnthropicProvider } from "@/lib/llm/anthropic";
import { GoogleProvider } from "@/lib/llm/google";
import type { AiProviderConfig } from "@/lib/settings";
import type { FetchLike, LlmModel } from "@/lib/llm/types";

/** Records what was sent and replays a scripted sequence of responses. */
function stubFetch(script: Array<{ status: number; body?: unknown; raw?: string; throw?: Error }>) {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  let i = 0;

  const impl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), init });
    const step = script[Math.min(i++, script.length - 1)];

    if (step.throw) throw step.throw;

    return {
      status: step.status,
      ok: step.status >= 200 && step.status < 300,
      text: async () => step.raw ?? JSON.stringify(step.body ?? {}),
    } as unknown as Response;
  };

  return { impl, calls, sent: () => calls.map((c) => JSON.parse(String(c.init?.body))) };
}

const OPENAI_CONFIG: AiProviderConfig = {
  provider: "openai",
  apiKey: "sk-test-secret",
  model: "gpt-4.1-mini",
  baseUrl: null,
};

const openaiOk = {
  choices: [{ message: { content: "سلام" }, finish_reason: "stop" }],
  model: "gpt-4.1-mini",
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

describe("resolveProvider", () => {
  it("refuses to run without an API key rather than degrading silently", () => {
    expect(() =>
      resolveProvider({ ...OPENAI_CONFIG, apiKey: null }),
    ).toThrow(LlmError);
  });

  it("refuses custom mode without an endpoint", () => {
    expect(() =>
      resolveProvider({ provider: "custom", apiKey: "k", model: "qwen-7b", baseUrl: null }),
    ).toThrow(/endpoint/);
  });

  it("refuses an empty model for providers that need an explicit name", () => {
    expect(() =>
      resolveProvider({ provider: "custom", apiKey: "k", model: "", baseUrl: "https://x/v1" }),
    ).toThrow(/مدل/);
  });

  it("builds the right driver per provider", () => {
    expect(resolveProvider(OPENAI_CONFIG)).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(
      resolveProvider({ provider: "anthropic", apiKey: "k", model: "claude-haiku-4.5", baseUrl: null }),
    ).toBeInstanceOf(AnthropicProvider);
    expect(
      resolveProvider({ provider: "google", apiKey: "k", model: "gemini-2.5-flash", baseUrl: null }),
    ).toBeInstanceOf(GoogleProvider);
  });

  it("never embeds the API key in the model list handed to the UI", () => {
    const provider = resolveProvider({ ...OPENAI_CONFIG, apiKey: "sk-super-secret" });
    expect(JSON.stringify(provider.models)).not.toContain("sk-super-secret");
  });
});

describe("OpenAI-compatible driver", () => {
  it("sends a Bearer token, the configured model and the messages", async () => {
    const { impl, calls, sent } = stubFetch([{ status: 200, body: openaiOk }]);
    const provider = resolveProvider(OPENAI_CONFIG, impl);

    const res = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.text).toBe("سلام");
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-secret");

    const body = sent()[0];
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("requests strict JSON only when the caller will parse the output", async () => {
    const { impl, sent } = stubFetch([{ status: 200, body: openaiOk }]);
    const provider = resolveProvider(OPENAI_CONFIG, impl);

    await provider.complete({ messages: [{ role: "user", content: "a" }] });
    await provider.complete({ messages: [{ role: "user", content: "b" }], json: true });

    expect(sent()[0].response_format).toBeUndefined();
    expect(sent()[1].response_format).toEqual({ type: "json_object" });
  });

  it("reports token usage when the provider supplies it", async () => {
    const { impl } = stubFetch([{ status: 200, body: openaiOk }]);
    const res = await resolveProvider(OPENAI_CONFIG, impl).complete({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("honours a custom endpoint and model, which is how a self-hosted Qwen is reached", async () => {
    const { impl, calls, sent } = stubFetch([{ status: 200, body: openaiOk }]);
    const provider = resolveProvider(
      { provider: "custom", apiKey: "k", model: "qwen-7b-instruct", baseUrl: "http://127.0.0.1:8000/v1/" },
      impl,
    );

    await provider.complete({ messages: [{ role: "user", content: "hi" }] });

    expect(calls[0].url).toBe("http://127.0.0.1:8000/v1/chat/completions");
    expect(sent()[0].model).toBe("qwen-7b-instruct");
  });

  it("maps 401 to a non-retryable error naming the provider", async () => {
    const { impl } = stubFetch([{ status: 401, body: { error: { message: "Incorrect API key" } } }]);

    await expect(
      resolveProvider(OPENAI_CONFIG, impl).complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ name: "LlmError", status: 401, provider: "openai" });
  });

  it("maps 429 and 5xx to retryable errors", async () => {
    for (const status of [429, 503]) {
      const { impl } = stubFetch([{ status, body: { error: { message: "busy" } } }]);

      await expect(
        resolveProvider(OPENAI_CONFIG, impl).complete({ messages: [{ role: "user", content: "x" }] }),
      ).rejects.toBeInstanceOf(LlmTransientError);
    }
  });

  it("does not leak the API key into a network failure message", async () => {
    const { impl } = stubFetch([{ status: 0, throw: new Error("socket hang up for sk-test-secret") }]);

    await expect(
      resolveProvider(OPENAI_CONFIG, impl).complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(LlmTransientError);
  });

  it("fails clearly when the provider returns something unparsable", async () => {
    const { impl } = stubFetch([{ status: 200, raw: "<html>gateway error</html>" }]);

    await expect(
      resolveProvider(OPENAI_CONFIG, impl).complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/JSON/);
  });
});

describe("Anthropic driver", () => {
  const anthropicOk = {
    model: "claude-haiku-4.5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: "درود" }],
    usage: { input_tokens: 7, output_tokens: 3 },
  };

  const config: AiProviderConfig = {
    provider: "anthropic",
    apiKey: "sk-ant-test",
    model: "claude-haiku-4.5",
    baseUrl: null,
  };

  it("uses x-api-key plus the mandatory version header, not a Bearer token", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: anthropicOk }]);

    await resolveProvider(config, impl).complete({ messages: [{ role: "user", content: "hi" }] });

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers.Authorization).toBeUndefined();
    expect(headers["anthropic-version"]).toBeTruthy();
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
  });

  it("moves the system prompt out of the messages array", async () => {
    const { impl, sent } = stubFetch([{ status: 200, body: anthropicOk }]);

    await resolveProvider(config, impl).complete({
      messages: [
        { role: "system", content: "You are terse." },
        { role: "user", content: "hi" },
      ],
    });

    const body = sent()[0];
    expect(body.system).toBe("You are terse.");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("always sends max_tokens, which Anthropic requires", async () => {
    const { impl, sent } = stubFetch([{ status: 200, body: anthropicOk }]);

    await resolveProvider(config, impl).complete({ messages: [{ role: "user", content: "hi" }] });

    expect(typeof sent()[0].max_tokens).toBe("number");
  });

  it("concatenates the text blocks of the response", async () => {
    const { impl } = stubFetch([
      {
        status: 200,
        body: {
          model: "m",
          content: [{ type: "text", text: "الف " }, { type: "text", text: "ب" }],
        },
      },
    ]);

    const res = await resolveProvider(config, impl).complete({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.text).toBe("الف ب");
  });

  it("treats 529 (overloaded) as retryable", async () => {
    const { impl } = stubFetch([{ status: 529, body: { error: { message: "overloaded" } } }]);

    await expect(
      resolveProvider(config, impl).complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toBeInstanceOf(LlmTransientError);
  });
});

describe("Gemini driver", () => {
  const config: AiProviderConfig = {
    provider: "google",
    apiKey: "AIza-test",
    model: "gemini-2.5-flash",
    baseUrl: null,
  };

  const geminiOk = {
    candidates: [
      { content: { parts: [{ text: "سلام" }] }, finishReason: "STOP" },
    ],
    usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 },
  };

  it("puts the model in the path and the key in the query string", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: geminiOk }]);

    await resolveProvider(config, impl).complete({ messages: [{ role: "user", content: "hi" }] });

    expect(calls[0].url).toContain("/models/gemini-2.5-flash:generateContent");
    expect(calls[0].url).toContain("key=AIza-test");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("renames the assistant role to model", async () => {
    const { impl, sent } = stubFetch([{ status: 200, body: geminiOk }]);

    await resolveProvider(config, impl).complete({
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ],
    });

    expect(sent()[0].contents.map((c: { role: string }) => c.role)).toEqual(["user", "model"]);
  });

  it("uses systemInstruction and the JSON response mime type", async () => {
    const { impl, sent } = stubFetch([{ status: 200, body: geminiOk }]);

    await resolveProvider(config, impl).complete({
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "hi" },
      ],
      json: true,
    });

    expect(sent()[0].systemInstruction).toEqual({ parts: [{ text: "Be brief." }] });
    expect(sent()[0].generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("complete() retry policy", () => {
  it("retries a transient failure and returns the later success", async () => {
    const { impl, calls } = stubFetch([
      { status: 503, body: { error: { message: "unavailable" } } },
      { status: 200, body: openaiOk },
    ]);

    const provider = resolveProvider(OPENAI_CONFIG, impl);
    const res = await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { provider, retries: 2 },
    );

    expect(res.text).toBe("سلام");
    expect(calls.length).toBe(2);
  });

  it("does not retry a permanent failure", async () => {
    const { impl, calls } = stubFetch([{ status: 401, body: { error: { message: "bad key" } } }]);

    await expect(
      complete({ messages: [{ role: "user", content: "hi" }] }, { provider: resolveProvider(OPENAI_CONFIG, impl), retries: 3 }),
    ).rejects.toBeInstanceOf(LlmError);

    expect(calls.length).toBe(1);
  });

  it("gives up after the configured number of attempts", async () => {
    const { impl, calls } = stubFetch([{ status: 429, body: { error: { message: "slow down" } } }]);

    await expect(
      complete({ messages: [{ role: "user", content: "hi" }] }, { provider: resolveProvider(OPENAI_CONFIG, impl), retries: 1 }),
    ).rejects.toBeInstanceOf(LlmTransientError);

    expect(calls.length).toBe(2);
  });

  it("reports each retry to the caller so it can be logged", async () => {
    const { impl } = stubFetch([
      { status: 500, body: { error: { message: "boom" } } },
      { status: 200, body: openaiOk },
    ]);

    const seen: number[] = [];
    await complete(
      { messages: [{ role: "user", content: "hi" }] },
      { provider: resolveProvider(OPENAI_CONFIG, impl), retries: 2, onRetry: (n) => seen.push(n) },
    );

    expect(seen).toEqual([1]);
  });
});

describe("parseJsonLoose", () => {
  it("parses a plain object", () => {
    expect(parseJsonLoose<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses an object wrapped in a markdown fence", () => {
    expect(parseJsonLoose<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses an object surrounded by prose", () => {
    expect(parseJsonLoose<{ a: number }>('Sure! Here you go: {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it("fails loudly on something unsalvageable rather than returning undefined", () => {
    expect(() => parseJsonLoose("I cannot help with that.")).toThrow(LlmError);
  });

  it("round-trips through completeJson", async () => {
    const { impl } = stubFetch([
      { status: 200, body: { choices: [{ message: { content: '```json\n{"slug":"x"}\n```' } }] } },
    ]);

    const parsed = await completeJson<{ slug: string }>(
      { messages: [{ role: "user", content: "spec" }] },
      { provider: resolveProvider(OPENAI_CONFIG, impl) },
    );

    expect(parsed).toEqual({ slug: "x" });
  });
});

describe("routeModel", () => {
  // Costs are realistic: a heavier model is never the same price as a
  // lighter one. See the equal-cost test below for the tie-break rule.
  const MODELS: LlmModel[] = [
    { id: "small", label: "Small", contextTokens: 8_000, supportsJson: true, capability: CAPABILITY.LIGHT, cost: 1 },
    { id: "mid", label: "Mid", contextTokens: 32_000, supportsJson: true, capability: CAPABILITY.MEDIUM, cost: 2 },
    { id: "big", label: "Big", contextTokens: 200_000, supportsJson: true, capability: CAPABILITY.HEAVY, cost: 3 },
    { id: "big-cheap", label: "Big cheap", contextTokens: 200_000, supportsJson: true, capability: CAPABILITY.HEAVY, cost: 2 },
  ];

  it("picks the cheapest model that clears the bar", () => {
    expect(routeModel(MODELS, TASKS.classifyModules)?.model.id).toBe("small");
    expect(routeModel(MODELS, TASKS.writeCode)?.model.id).toBe("big-cheap");
  });

  it("prefers the more capable model when two cost the same", () => {
    // Same price, better output — there is no reason to pick the weaker one.
    const tied: LlmModel[] = [
      { id: "weak", label: "Weak", contextTokens: 200_000, supportsJson: true, capability: CAPABILITY.LIGHT, cost: 2 },
      { id: "strong", label: "Strong", contextTokens: 200_000, supportsJson: true, capability: CAPABILITY.HEAVY, cost: 2 },
    ];

    expect(routeModel(tied, TASKS.classifyModules)?.model.id).toBe("strong");
  });

  it("respects an explicit admin choice over the cost heuristic", () => {
    expect(routeModel(MODELS, TASKS.classifyModules, "big")?.model.id).toBe("big");
  });

  it("skips models whose context window is too small", () => {
    // writeCode needs 64k tokens; only the 200k models qualify.
    const routed = routeModel(MODELS, { capability: CAPABILITY.HEAVY, maxInputTokens: 100_000 });
    expect(["big", "big-cheap"]).toContain(routed?.model.id);
  });

  it("downgrades rather than failing when nothing clears the bar", () => {
    const tiny = [MODELS[0]];
    const routed = routeModel(tiny, TASKS.writeCode);

    expect(routed?.model.id).toBe("small");
    expect(routed?.downgraded).toBe(true);
  });

  it("prefers a JSON-capable model when the task needs JSON", () => {
    const mixed: LlmModel[] = [
      { id: "no-json", label: "No JSON", contextTokens: 200_000, supportsJson: false, capability: CAPABILITY.HEAVY, cost: 1 },
      { id: "json", label: "JSON", contextTokens: 200_000, supportsJson: true, capability: CAPABILITY.HEAVY, cost: 2 },
    ];

    expect(routeModel(mixed, TASKS.draftSpec)?.model.id).toBe("json");
  });

  it("returns null for a provider with no known models", () => {
    expect(routeModel([], TASKS.classifyModules)).toBeNull();
  });
});
