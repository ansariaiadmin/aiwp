import { describe, it, expect } from "vitest";
import { topologicalOrder, planBuild, stepInstruction } from "@/lib/ai/planner";
import { reflectionPrompt } from "@/lib/ai/generate";

describe("topologicalOrder", () => {
  it("orders a dependency before its dependent", () => {
    const requiresOf = (id: string) => (id === "b" ? ["a"] : []);
    const { ordered, cycle } = topologicalOrder(["b", "a"], requiresOf);

    expect(cycle).toEqual([]);
    expect(ordered.indexOf("a")).toBeLessThan(ordered.indexOf("b"));
  });

  it("reports the members of a cycle instead of guessing an order", () => {
    // a -> b -> a
    const requiresOf = (id: string) => (id === "a" ? ["b"] : ["a"]);
    const { ordered, cycle } = topologicalOrder(["a", "b"], requiresOf);

    expect(ordered).toEqual([]);
    expect(cycle.sort()).toEqual(["a", "b"]);
  });

  it("keeps a stable order among independent nodes", () => {
    const { ordered } = topologicalOrder(["x", "y", "z"], () => []);
    expect(ordered).toEqual(["x", "y", "z"]);
  });
});

describe("planBuild", () => {
  it("builds scheduler before cron-report, which requires it", () => {
    const result = planBuild("demo", ["cron-report", "scheduler"]);

    expect(result.error).toBeUndefined();
    const order = result.plan!.steps.map((s) => s.moduleId);
    expect(order.indexOf("scheduler")).toBeLessThan(order.indexOf("cron-report"));
  });

  it("rejects a module the model invented", () => {
    const result = planBuild("demo", ["not-a-real-module"]);
    expect(result.error).toEqual({ kind: "unknown-module", moduleId: "not-a-real-module" });
  });

  it("rejects a module whose dependency is missing from the plan", () => {
    // cron-report requires scheduler; omitting scheduler is an impossible plan.
    const result = planBuild("demo", ["cron-report"]);
    expect(result.error).toEqual({
      kind: "missing-dependency",
      moduleId: "cron-report",
      requires: "scheduler",
    });
  });

  it("gives every step the blocker rules", () => {
    const result = planBuild("demo", ["settings-page"]);
    expect(result.plan!.steps[0].rules.length).toBeGreaterThan(0);
    expect(result.plan!.steps[0].rules.every((r) => r.severity === "blocker")).toBe(true);
  });
});

describe("stepInstruction", () => {
  it("scopes the model to one module with its rules", () => {
    const result = planBuild("demo", ["cron-report", "scheduler"]);
    const step = result.plan!.steps.find((s) => s.moduleId === "cron-report")!;
    const text = stepInstruction(step);

    expect(text).toContain("cron-report");
    expect(text).toContain("scheduler"); // its dependency is named
    expect(text).toContain("Non-negotiable rules");
  });
});

describe("reflectionPrompt", () => {
  it("asks the model to find its own breaches, not defend the code", () => {
    const text = reflectionPrompt("<?php echo $x;", "- escape every output");

    expect(text).toContain("Do not defend it");
    expect(text).toContain("escape every output");
    expect(text).toContain("echo $x;");
  });
});
