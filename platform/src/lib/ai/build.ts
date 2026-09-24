/**
 * The end-to-end build: spec in, reviewed modules out.
 *
 * This is the wire that connects everything the factory has learned to do
 * into one pipeline a single call can run:
 *
 *   planBuild      decompose the spec into ordered, dependency-sorted steps
 *   generateWithRetry  for each step, ask a model for the module and retry
 *                  until it clears the mechanical scan (or the cap is hit)
 *   reflection     optionally critique the final module before accepting it
 *
 * The model is injected as `generateModule`, so the whole orchestration —
 * planning, the per-module retry loop, assembly, honest failure reporting —
 * is testable offline with a fake generator, and the same code drives a real
 * provider in production. That separation is the point: the pipeline's
 * correctness does not depend on a model being available to prove it.
 *
 * Failure is reported per module rather than hidden. A build where one
 * module never cleared the scan returns ok:false with that module's
 * remaining breaches, so the caller decides whether to ship a partial
 * plugin, retry with a stronger model, or hand it to a human. The pipeline
 * never pretends a breaching module is clean.
 */

import { planBuild, stepInstruction, type BuildPlan, type BuildStep, type PlanError } from "./planner";
import { generateWithRetry, reflectionPrompt, type GenerateAttemptContext } from "./generate";
import { rulesForPrompt } from "./rules";
import type { EmbeddingConfig } from "@/lib/rag/embeddings";
import type { AgentEventInput } from "./metrics";

export interface BuildSpec {
  slug: string;
  name: string;
  description: string;
  /** Module ids chosen by draft-spec; the planner orders them. */
  modules: string[];
  /** Behavioural requirements the generated code must satisfy. */
  features: string[];
}

/**
 * Produces one module's PHP for a build step.
 *
 * `attempt` carries the retry context — the breaches the previous attempt
 * produced — so a real implementation can feed them back to the model. The
 * default implementation (llmGenerateModule) does exactly that through the
 * configured provider.
 */
export type GenerateModuleFn = (
  step: BuildStep,
  spec: BuildSpec,
  attempt: GenerateAttemptContext,
) => Promise<string>;

export interface RunBuildOptions {
  /** Injectable model call; defaults to the configured LLM provider. */
  generateModule?: GenerateModuleFn;
  /** Embedding config forwarded to the lesson write-back. */
  config?: EmbeddingConfig;
  /** Retry cap per module. */
  maxAttempts?: number;
  /** Injectable so the loop is testable without a database. */
  recordEvent?: (event: AgentEventInput) => Promise<void>;
  /** Run a reflection critique on each module's final attempt. */
  reflect?: boolean;
  /** Injected reflection call; only used when reflect is true. */
  reflectFn?: (prompt: string) => Promise<string>;
}

export interface ModuleResult {
  moduleId: string;
  order: number;
  code: string;
  clean: boolean;
  attempts: number;
  /** Breaches still present on the final attempt; empty when clean. */
  violations: string[];
  lessonsRecorded: number;
  /** The reflection critique, when reflect was requested. */
  reflection?: string;
}

export interface BuildResult {
  ok: boolean;
  slug: string;
  modules: ModuleResult[];
  /** Set when planning itself failed, before any module was generated. */
  planError?: PlanError;
}

/**
 * Runs the full pipeline for a spec.
 *
 * Plans first — an impossible plan (invented module, missing dependency,
 * cycle) is reported before a single model call is spent. Then builds each
 * module in dependency order through the retry loop, optionally reflects on
 * the result, and assembles. ok is true only when every module cleared the
 * scan; a single breaching module makes the whole build not-ok, with the
 * offending breaches named.
 */
export async function runBuild(
  spec: BuildSpec,
  options: RunBuildOptions = {},
): Promise<BuildResult> {
  const generateModule = options.generateModule ?? llmGenerateModule;
  const reflectFn = options.reflectFn ?? llmReflect;
  const maxAttempts = options.maxAttempts ?? 3;

  const planned = planBuild(spec.slug, spec.modules, spec.features);

  if (planned.error || !planned.plan) {
    return { ok: false, slug: spec.slug, modules: [], planError: planned.error };
  }

  const plan: BuildPlan = planned.plan;
  const modules: ModuleResult[] = [];

  for (const step of plan.steps) {
    const generated = await generateWithRetry({
      generate: (attempt) => generateModule(step, spec, attempt),
      config: options.config,
      maxAttempts,
      recordEvent: options.recordEvent,
      context: `${spec.slug}/${step.moduleId}`,
    });

    let reflection: string | undefined;
    if (options.reflect) {
      reflection = await reflectFn(
        reflectionPrompt(generated.code, rulesForPrompt()),
      );
    }

    modules.push({
      moduleId: step.moduleId,
      order: step.order,
      code: generated.code,
      clean: generated.clean,
      attempts: generated.attempts,
      violations: generated.violations.map((v) => v.ruleId),
      lessonsRecorded: generated.lessonsRecorded,
      reflection,
    });
  }

  return {
    ok: modules.every((m) => m.clean),
    slug: spec.slug,
    modules,
  };
}

/**
 * The default module generator, wired to the configured LLM provider.
 *
 * Builds a prompt from the step instruction, the spec's features, and — on a
 * retry — the breaches the previous attempt produced, then asks the model
 * for the module's code. Routing uses the writeCode task profile so a small
 * self-hosted model is only asked for what it can handle, and a downgrade is
 * surfaced rather than hidden.
 */
export const llmGenerateModule: GenerateModuleFn = async (step, spec, attempt) => {
  // Imported lazily so the orchestration above stays testable without
  // pulling in the provider layer (and its settings/database reads).
  const { complete, getProvider, routeModel, TASKS } = await import("@/lib/llm");

  const provider = await getProvider();
  const routed = routeModel(provider.models, TASKS.writeCode, null);

  const system = [
    "You are a WordPress plugin module generator.",
    "Write only the PHP for the single module requested. No prose, no markdown fence.",
    "Follow every rule exactly.",
  ].join("\n");

  const retryNote =
    attempt.priorViolations.length > 0
      ? `\nYour previous attempt breached these rules — fix every one:\n${attempt.priorViolations
          .map((v) => `- ${v.ruleId}: ${v.evidence}`)
          .join("\n")}`
      : "";

  const user = [
    `Plugin: ${spec.name} (${spec.slug}) — ${spec.description}`,
    `Features this plugin must satisfy:\n${spec.features.map((f) => `- ${f}`).join("\n")}`,
    "",
    stepInstruction(step),
    retryNote,
  ].join("\n");

  const response = await complete(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: routed?.model.id,
      temperature: 0.2,
    },
    { provider },
  );

  return response.text;
};

/**
 * The default reflection call, wired to the configured provider. Injected
 * as the fallback when a caller asks to reflect but does not supply its own
 * reflectFn, so `reflect: true` always produces a critique instead of being
 * silently ignored.
 */
export const llmReflect: (prompt: string) => Promise<string> = async (prompt) => {
  const { complete, getProvider } = await import("@/lib/llm");
  const provider = await getProvider();

  const response = await complete(
    { messages: [{ role: "user", content: prompt }], temperature: 0.1 },
    { provider },
  );

  return response.text;
};
