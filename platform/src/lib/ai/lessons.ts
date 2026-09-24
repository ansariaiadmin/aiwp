/**
 * The self-improvement loop.
 *
 * A static ruleset stops the agent from breaching a rule it has been told
 * about; it does nothing about the breaches that slip through. This closes
 * that gap: every time a violation is caught and fixed, the fix is written
 * back into the knowledge base as a retrievable lesson keyed to the rule.
 *
 * The mechanism is deliberately simple and leans entirely on retrieval:
 *
 *   recordLesson()  → ingests "rule X was breached like this, the fix is
 *                     that" into kb_documents (sourceKind CODE, sourceKey
 *                     lesson:<ruleId>), through the same ingest path as any
 *                     other document, so it gets normalised, chunked and
 *                     embedded like everything else.
 *
 *   Because generation already grounds itself in the KB (draft-spec
 *   retrieves the most relevant chunks before writing), a recorded lesson
 *   is surfaced the next time a similar feature is drafted — with no extra
 *   wiring. The corpus the agent reads literally grows from its own
 *   corrections, so the same mistake becomes progressively less likely.
 *
 * One lesson is kept per rule (sourceKey lesson:<ruleId>), so the loop stays
 * bounded: re-recording a rule updates the lesson with the latest fix rather
 * than accumulating thousands of near-duplicates that would crowd out real
 * documentation in retrieval.
 */

import { ingestDocument } from "@/lib/rag";
import type { EmbeddingConfig } from "@/lib/rag/embeddings";
import { QUALITY_RULES, scanForViolations, type RuleSeverity, type RuleViolation } from "./rules";
import { recordAgentEvent, type AgentEventInput } from "./metrics";

export interface LessonInput {
  /** Which rule was breached. */
  ruleId: string;
  /** What the generated code actually did wrong. */
  problem: string;
  /** The correction that fixed it. */
  fix: string;
  /** Optional surrounding context — the feature, the module, the file. */
  context?: string;
}

export interface RecordLessonResult {
  lessonKey: string;
  chunks: number;
  skipped: boolean;
}

/**
 * Writes a correction back into the knowledge base.
 *
 * The body is structured so retrieval matches it on the rule, the symptom
 * and the fix alike: whichever angle a future query comes from, the lesson
 * is findable. The rule's own text and rationale are included so the lesson
 * stands alone — a reader (or model) who retrieves only this chunk still
 * learns the rule, not just the one incident.
 */
export async function recordLesson(
  input: LessonInput,
  config: EmbeddingConfig = { kind: "local" },
): Promise<RecordLessonResult> {
  const rule = QUALITY_RULES.find((r) => r.id === input.ruleId);
  const severity: RuleSeverity = rule?.severity ?? "major";

  const body = [
    `# Lesson: ${rule?.rule ?? input.ruleId}`,
    "",
    `Rule id: ${input.ruleId}`,
    `Severity: ${severity}`,
    rule ? `Why it matters: ${rule.why}` : "",
    "",
    "## What went wrong",
    input.problem,
    "",
    "## The fix",
    input.fix,
    input.context ? `\n## Context\n${input.context}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const lessonKey = `lesson:${input.ruleId}`;

  const result = await ingestDocument(
    {
      sourceKind: "CODE",
      sourceKey: lessonKey,
      title: `Lesson: ${input.ruleId}`,
      body,
    },
    config,
  );

  return {
    lessonKey,
    chunks: result.chunks,
    skipped: Boolean(result.skipped),
  };
}

/**
 * A short summary of the ruleset for an operator dashboard — how many rules
 * exist at each severity. Used to show the bar the agent is held to.
 */
export function rulesetSummary(): {
  total: number;
  blocker: number;
  major: number;
  minor: number;
} {
  return {
    total: QUALITY_RULES.length,
    blocker: QUALITY_RULES.filter((r) => r.severity === "blocker").length,
    major: QUALITY_RULES.filter((r) => r.severity === "major").length,
    minor: QUALITY_RULES.filter((r) => r.severity === "minor").length,
  };
}

export interface ReviewResult {
  /** The breaches the mechanical scan caught. */
  violations: RuleViolation[];
  /** How many lessons were written back (one per distinct rule breached). */
  lessonsRecorded: number;
  /** True when the code cleared every rule that has a detector. */
  clean: boolean;
}

export interface ReviewOptions {
  config?: EmbeddingConfig;
  /** Injectable so the loop is testable without a database. */
  recordEvent?: (event: AgentEventInput) => Promise<void>;
  /** Optional context forwarded to each recorded lesson. */
  context?: string;
}

/**
 * The automatic half of the self-improvement loop.
 *
 * Scans generated PHP, and for every rule breached: logs a violation event
 * (so the trend is measurable) and writes a lesson back into the KB (so the
 * next draft is grounded in the fix). The fix text is derived from the rule
 * itself — the mechanical scan knows *which* rule was broken and the ruleset
 * carries the correction, so the loop closes without a human in it for the
 * breaches that have a reliable signature.
 *
 * This is the piece that makes correction automatic rather than a button an
 * operator has to press. It only covers rules with a `detect` signature; the
 * subtle breaches still need a model/human review, and recording those is
 * what recordLesson() (the manual half) is for.
 */
export async function reviewAndLearn(
  php: string,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  const config = options.config ?? { kind: "local" };
  const recordEvent = options.recordEvent ?? recordAgentEvent;

  const violations = scanForViolations(php);

  if (violations.length === 0) {
    return { violations: [], lessonsRecorded: 0, clean: true };
  }

  // One lesson per distinct rule, even if the rule was breached on many lines.
  const byRule = new Map<string, RuleViolation>();
  for (const v of violations) {
    if (!byRule.has(v.ruleId)) byRule.set(v.ruleId, v);
  }

  let lessonsRecorded = 0;

  for (const violation of byRule.values()) {
    const rule = QUALITY_RULES.find((r) => r.id === violation.ruleId);

    await recordEvent({
      ruleId: violation.ruleId,
      severity: violation.severity,
      kind: "violation",
      detail: violation.evidence,
    });

    await recordLesson(
      {
        ruleId: violation.ruleId,
        problem: `Generated code breached ${violation.ruleId}: ${violation.evidence}`,
        fix: rule?.rule ?? `Follow the ${violation.ruleId} rule.`,
        context: options.context,
      },
      config,
    );

    await recordEvent({
      ruleId: violation.ruleId,
      severity: violation.severity,
      kind: "fix",
      detail: "lesson recorded",
    });

    lessonsRecorded += 1;
  }

  return { violations, lessonsRecorded, clean: false };
}
