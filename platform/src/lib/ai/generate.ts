/**
 * The self-correction loop.
 *
 * Everything built so far — the strict ruleset, the mechanical scan, the
 * lesson write-back, the measurable trend — exists to make one thing
 * possible: a model that is not good enough on the first try still ships
 * code that clears the bar, because it is shown its own breaches and asked
 * again.
 *
 * `generateWithRetry()` is that loop. It is deliberately provider-agnostic:
 * the caller injects `generate`, the function that actually asks a model for
 * code, so the loop works identically whether the model is a frontier API or
 * a self-hosted Qwen 7B. The loop's job is not to be smart — it is to be
 * relentless:
 *
 *   1. Ask the model for code, telling it which rules it breached last time.
 *   2. Run the real reviewAndLearn() over the result — which catches the
 *      breaches, records them as measurable events, and writes the fix back
 *      into the KB so the *next* feature benefits too.
 *   3. If it is clean, stop. If not, feed the breaches back and try again,
 *      up to a hard cap.
 *
 * The cap matters. An endless retry loop is how a platform burns a model
 * budget producing nothing; a bounded one that hands back the best attempt
 * plus the remaining breaches is honest about what it could and could not
 * fix, and leaves the decision to the caller.
 *
 * Note the asymmetry the loop exploits: the scan only catches breaches with
 * a reliable textual signature, so `clean` means "no detector-signature
 * breach", not "provably secure". The loop drives the obvious breaches to
 * zero; the subtle ones still need a model/human review. That boundary is
 * the same one scanForViolations() documents, and it is not hidden here.
 */

import type { EmbeddingConfig } from "@/lib/rag/embeddings";
import { reviewAndLearn } from "./lessons";
import type { RuleViolation } from "./rules";
import type { AgentEventInput } from "./metrics";

export interface GenerateAttemptContext {
  /** 1-based attempt number. */
  attempt: number;
  /**
   * The breaches the previous attempt produced, so the model can be told
   * exactly what to fix. Empty on the first attempt.
   */
  priorViolations: RuleViolation[];
}

/** The injected model call. Returns the generated PHP for this attempt. */
export type GenerateFn = (context: GenerateAttemptContext) => Promise<string>;

export interface GenerateWithRetryOptions {
  generate: GenerateFn;
  /** Embedding config forwarded to the lesson write-back. */
  config?: EmbeddingConfig;
  /** Hard cap on attempts. Defaults to 3. */
  maxAttempts?: number;
  /** Injectable so the loop is testable without a database. */
  recordEvent?: (event: AgentEventInput) => Promise<void>;
  /** Optional context forwarded to each recorded lesson. */
  context?: string;
}

export interface GenerateResult {
  /** The code from the final attempt (the clean one, or the best effort). */
  code: string;
  /** How many attempts were made. */
  attempts: number;
  /** True when the final attempt cleared every detector-signature rule. */
  clean: boolean;
  /** The breaches still present on the final attempt; empty when clean. */
  violations: RuleViolation[];
  /** Total lessons written back across all attempts. */
  lessonsRecorded: number;
}

/**
 * Generates code, reviews it, and retries until it is clean or the attempt
 * cap is reached. Each retry is told what the previous attempt got wrong,
 * and every breach — on any attempt — is recorded and turned into a lesson,
 * so the loop both fixes the code in front of it and teaches the corpus for
 * the code that comes after.
 */
export async function generateWithRetry(
  options: GenerateWithRetryOptions,
): Promise<GenerateResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);

  let priorViolations: RuleViolation[] = [];
  let lastCode = "";
  let lessonsRecorded = 0;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;

    const code = await options.generate({ attempt, priorViolations });
    lastCode = code;

    const review = await reviewAndLearn(code, {
      config: options.config,
      recordEvent: options.recordEvent,
      context: options.context,
    });

    lessonsRecorded += review.lessonsRecorded;

    if (review.clean) {
      return {
        code,
        attempts,
        clean: true,
        violations: [],
        lessonsRecorded,
      };
    }

    // Carry the breaches into the next attempt so the model fixes exactly
    // these, rather than regenerating blind and hoping.
    priorViolations = review.violations;
  }

  return {
    code: lastCode,
    attempts,
    clean: false,
    violations: priorViolations,
    lessonsRecorded,
  };
}

/**
 * Renders the prior breaches into the instruction a model is given on a
 * retry. Kept separate so the exact wording the loop feeds back is pinned by
 * a test and stays consistent across providers.
 */
export function retryInstruction(priorViolations: RuleViolation[]): string {
  if (priorViolations.length === 0) return "";

  const lines = priorViolations.map(
    (v) => `- ${v.ruleId} (${v.severity}): ${v.evidence}`,
  );

  return [
    "Your previous attempt breached these rules. Fix every one of them:",
    ...lines,
    "Return only the corrected code.",
  ].join("\n");
}

/**
 * Reflection: the self-critique pass top agents run before finalizing.
 *
 * The mechanical scan catches breaches with a textual signature; reflection
 * catches the ones that need judgment. This renders the critique prompt a
 * model is given *after* producing code and *before* the result is accepted:
 * it is asked to find its own rule breaches and security holes, not to
 * defend the code. Kept as a pure string builder so the exact wording is
 * pinned by a test and stays consistent across providers.
 *
 * The loop does not call this on its own — reflection needs a model call, so
 * the caller decides when to spend it (typically on the final attempt, once
 * the obvious breaches are already driven to zero by the retry loop).
 */
export function reflectionPrompt(code: string, ruleSummary: string): string {
  return [
    "Review the code below against the rules. Do not defend it — find every",
    "way it breaches a rule, leaks data, or could break on a real site.",
    "List each problem with the line and the fix. If it is genuinely clean,",
    "say so and explain why each rule is satisfied.",
    "",
    "Rules:",
    ruleSummary,
    "",
    "Code:",
    code,
  ].join("\n");
}
