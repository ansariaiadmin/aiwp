import { describe, it, expect, vi } from "vitest";
import { runBuild, type BuildSpec, type GenerateModuleFn } from "@/lib/ai/build";

// generateWithRetry (inside runBuild) writes lessons through ingestDocument;
// mock it so the pipeline is pinned without a database, and inject
// recordEvent so no agent_events table is touched.
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

const spec: BuildSpec = {
  slug: "store-health",
  name: "Store Health",
  description: "Checks WooCommerce store health.",
  modules: ["cron-report", "scheduler"],
  features: ["Runs a daily health check", "Emails the report"],
};

describe("runBuild", () => {
  it("builds every module in dependency order and reports ok when all are clean", async () => {
    const built: string[] = [];
    const generateModule: GenerateModuleFn = async (step) => {
      built.push(step.moduleId);
      return `<?php\ndefined( 'ABSPATH' ) || exit;\n// ${step.moduleId}\necho esc_html( 'ok' );\n`;
    };

    const result = await runBuild(spec, { generateModule, recordEvent: noopRecordEvent });

    expect(result.ok).toBe(true);
    expect(result.planError).toBeUndefined();
    // scheduler must be built before cron-report, which requires it.
    expect(built.indexOf("scheduler")).toBeLessThan(built.indexOf("cron-report"));
    expect(result.modules.every((m) => m.clean)).toBe(true);
  });

  it("reports not-ok and names the breaches when a module never clears", async () => {
    const generateModule: GenerateModuleFn = async () => "<?php\necho $raw;\n";

    const result = await runBuild(spec, {
      generateModule,
      recordEvent: noopRecordEvent,
      maxAttempts: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.modules.length).toBe(2);
    expect(result.modules[0].clean).toBe(false);
    expect(result.modules[0].violations).toContain("escape-output");
  });

  it("refuses an impossible plan before spending a model call", async () => {
    let calls = 0;
    const generateModule: GenerateModuleFn = async () => {
      calls += 1;
      return "<?php\n";
    };

    const result = await runBuild(
      { ...spec, modules: ["not-a-real-module"] },
      { generateModule, recordEvent: noopRecordEvent },
    );

    expect(result.ok).toBe(false);
    expect(result.planError).toEqual({ kind: "unknown-module", moduleId: "not-a-real-module" });
    expect(calls).toBe(0);
  });

  it("captures the reflection critique when reflect is requested", async () => {
    const generateModule: GenerateModuleFn = async () =>
      "<?php\ndefined( 'ABSPATH' ) || exit;\necho esc_html( 'x' );\n";

    const result = await runBuild(spec, {
      generateModule,
      recordEvent: noopRecordEvent,
      reflect: true,
      reflectFn: async () => "No breaches found; output is escaped.",
    });

    expect(result.modules[0].reflection).toContain("No breaches found");
  });
});
