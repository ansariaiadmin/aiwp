import { describe, it, expect, vi } from "vitest";
import { rulesForPrompt, scanForViolations, QUALITY_RULES } from "@/lib/ai/rules";

// recordLesson's only side effect is ingestDocument(); mock it so the lesson
// loop is pinned without a database, exactly as the crawler tests do.
const ingested: Array<{ sourceKind: string; sourceKey: string; body: string; title: string }> = [];
vi.mock("@/lib/rag", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rag")>("@/lib/rag");
  return {
    ...actual,
    ingestDocument: vi.fn(async (input: { sourceKind: string; sourceKey: string; body: string; title: string }) => {
      ingested.push(input);
      return { documentId: "doc", chunks: 1, embeddingModel: "local-hash", embeddingKind: "local" };
    }),
  };
});

import { recordLesson, reviewAndLearn, rulesetSummary } from "@/lib/ai/lessons";

describe("rulesForPrompt", () => {
  it("lists blockers before majors and minors", () => {
    const prompt = rulesForPrompt();
    const blockerAt = prompt.indexOf("[BLOCKER]");
    const majorAt = prompt.indexOf("[MAJOR]");
    const minorAt = prompt.indexOf("[MINOR]");

    expect(blockerAt).toBeGreaterThanOrEqual(0);
    expect(blockerAt).toBeLessThan(majorAt);
    expect(majorAt).toBeLessThan(minorAt);
  });

  it("carries the rationale, not just the rule", () => {
    expect(rulesForPrompt()).toContain("because:");
  });
});

describe("scanForViolations", () => {
  it("flags a raw echo, eval, an order post-meta read and a __return_true callback", () => {
    const php = [
      "<?php",
      "echo $user_input;",
      "eval( $code );",
      "$meta = get_post_meta( $order_id, '_x', true );",
      "'permission_callback' => '__return_true',",
    ].join("\n");

    const ids = scanForViolations(php).map((v) => v.ruleId);

    expect(ids).toContain("escape-output");
    expect(ids).toContain("no-eval");
    expect(ids).toContain("hpos-orders");
    expect(ids).toContain("capability-check");
  });

  it("flags extract() and variable-variables as playbook bans them", () => {
    const php = "<?php\\nextract( $_POST );\\n$fn = 'x'; echo $$fn;\\n";
    const ids = scanForViolations(php).map((v) => v.ruleId);
    expect(ids).toContain("no-extract");
    expect(ids).toContain("no-variable-variables");
  });

  it("returns nothing for clean code", () => {
    expect(scanForViolations("<?php\ndefined( 'ABSPATH' ) || exit;\necho esc_html( $x );\n")).toEqual([]);
  });
});

describe("rulesetSummary", () => {
  it("counts every rule exactly once across severities", () => {
    const s = rulesetSummary();
    expect(s.blocker + s.major + s.minor).toBe(s.total);
    expect(s.total).toBe(QUALITY_RULES.length);
  });
});

describe("recordLesson", () => {
  it("files the lesson under the rule and includes the fix", async () => {
    ingested.length = 0;

    const result = await recordLesson({
      ruleId: "escape-output",
      problem: "echoed $title without escaping",
      fix: "wrapped it in esc_html()",
      context: "store-health admin page",
    });

    expect(result.lessonKey).toBe("lesson:escape-output");
    expect(ingested).toHaveLength(1);
    expect(ingested[0].sourceKind).toBe("CODE");
    expect(ingested[0].sourceKey).toBe("lesson:escape-output");
    expect(ingested[0].body).toContain("wrapped it in esc_html()");
    expect(ingested[0].body).toContain("XSS"); // the rule's rationale travels with the lesson
  });
});

describe("reviewAndLearn", () => {
  it("records a lesson and events for each breached rule", async () => {
    ingested.length = 0;
    const events: Array<{ ruleId: string; kind: string }> = [];
    const recordEvent = async (e: { ruleId: string; kind: string }) => {
      events.push(e);
    };

    const php = "<?php\necho $raw;\neval( $x );\n";
    const result = await reviewAndLearn(php, { recordEvent });

    expect(result.clean).toBe(false);
    expect(result.lessonsRecorded).toBe(2);
    expect(ingested.map((i) => i.sourceKey).sort()).toEqual([
      "lesson:escape-output",
      "lesson:no-eval",
    ]);
    expect(events.filter((e) => e.kind === "violation")).toHaveLength(2);
    expect(events.filter((e) => e.kind === "fix")).toHaveLength(2);
  });

  it("reports clean code without recording anything", async () => {
    ingested.length = 0;
    const events: unknown[] = [];
    const result = await reviewAndLearn("<?php\ndefined( 'ABSPATH' ) || exit;\necho esc_html( $x );\n", {
      recordEvent: async (e) => {
        events.push(e);
      },
    });

    expect(result.clean).toBe(true);
    expect(result.lessonsRecorded).toBe(0);
    expect(ingested).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it("collapses many breaches of the same rule into one lesson", async () => {
    ingested.length = 0;
    const result = await reviewAndLearn("<?php\necho $a;\necho $b;\necho $c;\n", {
      recordEvent: async () => {},
    });

    expect(result.lessonsRecorded).toBe(1);
    expect(ingested).toHaveLength(1);
  });
});
