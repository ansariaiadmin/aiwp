import { describe, it, expect, vi } from "vitest";
import { generateWithRetry, retryInstruction } from "@/lib/ai/generate";
import type { RuleViolation } from "@/lib/ai/rules";

// reviewAndLearn (called inside the loop) writes lessons through
// ingestDocument(); mock it so the loop is pinned without a database, and
// inject recordEvent so no agent_events table is touched either.
vi.mock("@/lib/rag", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rag")>("@/lib/rag");
  return {
    ...actual,
    ingestDocument: vi.fn(async () => ({
      documentId: "doc",
      chunks: 1,
      embeddingModel: "local-hash",
      embeddingKind: "local",
    })),
  };
});

const noopRecordEvent = async () => {};

describe("generateWithRetry", () => {
  it("retries until the code is clean and reports the attempt count", async () => {
    let attempt = 0;
    const generate = async () => {
      attempt += 1;
      // First attempt breaches escape-output; second is clean.
      return attempt === 1 ? "<?php\necho $raw;\n" : "<?php\necho esc_html( $raw );\n";
    };

    const result = await generateWithRetry({ generate, recordEvent: noopRecordEvent });

    expect(result.clean).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.violations).toEqual([]);
    // The breaching attempt recorded one escape-output lesson.
    expect(result.lessonsRecorded).toBe(1);
  });

  it("stops at the cap and hands back the remaining breaches", async () => {
    const generate = async () => "<?php\necho $raw;\neval( $x );\n";

    const result = await generateWithRetry({
      generate,
      recordEvent: noopRecordEvent,
      maxAttempts: 3,
    });

    expect(result.clean).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.violations.map((v) => v.ruleId).sort()).toEqual([
      "escape-output",
      "no-eval",
    ]);
  });

  it("returns immediately when the first attempt is already clean", async () => {
    const generate = async () => "<?php\ndefined( 'ABSPATH' ) || exit;\necho esc_html( $x );\n";

    const result = await generateWithRetry({ generate, recordEvent: noopRecordEvent });

    expect(result.clean).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.lessonsRecorded).toBe(0);
  });

  it("tells each retry what the previous attempt got wrong", async () => {
    const seen: Array<{ attempt: number; prior: number }> = [];
    let attempt = 0;
    const generate = async (ctx: { attempt: number; priorViolations: RuleViolation[] }) => {
      attempt += 1;
      seen.push({ attempt: ctx.attempt, prior: ctx.priorViolations.length });
      return attempt < 3 ? "<?php\necho $raw;\n" : "<?php\necho esc_html( $x );\n";
    };

    await generateWithRetry({ generate, recordEvent: noopRecordEvent });

    // First attempt has no prior violations; later attempts are told about them.
    expect(seen[0]).toEqual({ attempt: 1, prior: 0 });
    expect(seen[1].prior).toBeGreaterThan(0);
  });
});

describe("retryInstruction", () => {
  it("renders the breaches the model must fix", () => {
    const text = retryInstruction([
      { ruleId: "escape-output", severity: "blocker", evidence: "echo $x;" },
    ]);

    expect(text).toContain("escape-output");
    expect(text).toContain("echo $x;");
    expect(text).toContain("Fix every one");
  });

  it("is empty when there is nothing to fix", () => {
    expect(retryInstruction([])).toBe("");
  });
});
