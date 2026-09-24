import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { LlmError, completeJson, TASKS, routeModel, LlmTransientError } from "@/lib/llm";
import { getAiProviderConfig } from "@/lib/settings";
import { resolveProvider } from "@/lib/llm";
import { catalogueForPrompt } from "@/lib/ai/module-catalogue";
import { rulesForPrompt } from "@/lib/ai/rules";
import { toFactorySpec, validateFactorySpec } from "@/lib/ai/factory-spec";
import { searchKnowledge, buildContext, embeddingConfigFromSettings } from "@/lib/rag";
import { draftSpecSchema, draftedSpecSchema } from "@/lib/validation/ai";
import { logger } from "@/lib/logger";

/**
 * Turns a feature description into a plugin spec.
 *
 * This is the operator-facing half of the factory: instead of hand-writing
 * spec JSON, an admin describes what the plugin should do and gets a draft
 * back to review. Nothing is created — the caller decides what to do with
 * the result.
 */

const SYSTEM_PROMPT = `You are the specification writer for a WordPress plugin factory.

Given a feature description, produce a plugin specification as a single JSON object with exactly these keys:

- slug: kebab-case English identifier, e.g. "store-health"
- name: human-readable plugin name
- description: one sentence, plain text
- namespace: PHP namespace in StudlyCase with at least two segments, e.g. "AnsariAi\\StoreHealth"
- prefix: lowercase option/hook prefix, e.g. "ansariai_sh"
- textDomain: usually the same as slug
- version: "1.0.0"
- modules: array of module ids chosen ONLY from the catalogue below. Do not invent ids. Dependencies are resolved automatically, so list only what the plugin actually uses.
- options: array of settings fields, each {key, type, label, default?, tab?}. type is one of text, email, number, checkbox, textarea, select, password
- features: array of one-sentence behavioural requirements

Rules:
- Always include "license-client" — every plugin this factory builds is sold.
- Prefer fewer modules. Only include one if a described feature needs it.
- Keys and identifiers are English. Labels may be Persian if the description is Persian.
- Return JSON only. No prose, no markdown fence.

Module catalogue:
${catalogueForPrompt()}

Non-negotiable quality rules. Every module this spec implies must satisfy these; design the spec so they are satisfiable, and never propose a feature that would require breaching one:
${rulesForPrompt()}`;

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = draftSpecSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  const { description, slug } = parsed.data;

  // Surface a misconfiguration as a clear 409 rather than letting the LLM
  // layer throw from inside the request.
  let config;
  try {
    config = await getAiProviderConfig();
    resolveProvider(config);
  } catch (e) {
    const message = e instanceof LlmError ? e.message : "تنظیمات هوش مصنوعی معتبر نیست.";
    return jsonError(message, 409);
  }

  const provider = resolveProvider(config);
  const routed = routeModel(provider.models, TASKS.draftSpec, config.model);

  if (!routed) {
    return jsonError("سرویس‌دهنده‌ی مدل هیچ مدل شناخته‌شده‌ای ندارد.", 409);
  }

  // Ground the draft in the knowledge base. A small model invents plausible
  // but wrong WordPress APIs; handing it the relevant crawled documentation
  // first is the single cheapest way to make a weak model produce a correct
  // spec. Best-effort: an empty or unavailable KB must never block drafting.
  let reference = "";
  try {
    const hits = await searchKnowledge(description, {
      limit: 5,
      config: embeddingConfigFromSettings(config),
    });
    if (hits.length > 0) {
      reference = buildContext(hits, 2000).context;
    }
  } catch {
    reference = "";
  }

  const userPrompt = [
    slug ? `Use exactly this slug: ${slug}` : null,
    reference
      ? `Reference documentation retrieved from the knowledge base (ground your choices in this, do not invent APIs):\n${reference}`
      : null,
    "Feature description:",
    description,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const draft = await completeJson<unknown>(
      {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        model: routed.model.id,
        temperature: 0.2,
      },
      {
        provider,
        onRetry: (attempt, error) => {
          logger.warn(
            { attempt, status: error.status, provider: provider.id },
            "AI draft-spec retrying after transient failure",
          );
        },
      },
    );

    const validated = draftedSpecSchema.safeParse(draft);

    if (!validated.success) {
      return jsonError(
        `مدل spec نامعتبری تولید کرد: ${zodErrorMessage(validated.error)}`,
        502,
      );
    }

    await recordAuditLog({
      actorId: guard.session.userId,
      action: "product.created",
      targetType: "product",
      targetId: validated.data.slug,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        kind: "ai-draft-spec",
        modules: validated.data.modules,
        model: routed.model.id,
      },
    });

    // Complete the drafted spec into the full, compose-ready form the real
    // factory (tools/compose.php) consumes, filling the operational fields
    // the model must not guess (author, requirements, license) from the
    // operator's defaults. Validated here so a malformed spec is caught with
    // a clear message rather than as a failure inside the PHP composer.
    const factorySpec = toFactorySpec(validated.data);
    const factoryError = validateFactorySpec(factorySpec);

    if (factoryError) {
      return jsonError(
        `spec آماده‌ی ساخت نیست: ${factoryError.kind}` +
          ("field" in factoryError ? ` (${factoryError.field})` : "") +
          ("moduleId" in factoryError ? ` (${factoryError.moduleId})` : ""),
        502,
      );
    }

    return jsonOk({
      spec: validated.data,
      // The spec exactly as tools/build.php expects it — feed this straight
      // to the factory to compose a real, installable plugin.
      factorySpec,
      model: routed.model.id,
      // Lets the UI warn the operator that the chosen model was below the
      // capability the task normally wants.
      downgraded: routed.downgraded,
    });
  } catch (e) {
    if (e instanceof LlmTransientError) {
      return jsonError("سرویس‌دهنده‌ی مدل در دسترس نیست؛ کمی دیگر دوباره تلاش کنید.", 503);
    }

    if (e instanceof LlmError) {
      return jsonError(e.message, 502);
    }

    throw e;
  }
}
