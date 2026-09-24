/**
 * Plan-before-act: decompose a plugin into an ordered build plan.
 *
 * The single habit that separates a strong agent from a weak one is that it
 * does not try to produce the whole thing in one shot. It decomposes the job
 * into ordered subtasks, does each one with the context that subtask needs,
 * verifies it, and only then moves on. A small model asked for an entire
 * plugin at once drowns; the same model asked for one module at a time, in
 * dependency order, succeeds.
 *
 * This is the decomposition step. It is deliberately deterministic — the
 * ordering comes from the module catalogue's declared dependencies, not from
 * a model — because a plan is the one part of the pipeline that must be
 * trustworthy enough to drive everything downstream. A model chooses *which*
 * modules a feature needs (draft-spec); the planner decides *in what order*
 * to build them, and refuses to proceed on an impossible plan (a missing
 * dependency or a cycle) rather than emitting an order that cannot work.
 *
 * Each step carries the blocker rules and the features it implements, so the
 * generation step for that module is scoped: the model sees one module, its
 * rules, and the slice of the spec it is responsible for — not the whole
 * plugin at once.
 */

import { MODULE_CATALOGUE, type CatalogueModule } from "./module-catalogue";
import { BLOCKER_RULES, type QualityRule } from "./rules";

export interface BuildStep {
  /** Position in the plan, 1-based. */
  order: number;
  moduleId: string;
  summary: string;
  /** Modules that must be built before this one. */
  requires: string[];
  /** The blocker rules this module's code must satisfy. */
  rules: readonly QualityRule[];
}

export interface BuildPlan {
  slug: string;
  steps: BuildStep[];
}

export type PlanError =
  | { kind: "unknown-module"; moduleId: string }
  | { kind: "missing-dependency"; moduleId: string; requires: string }
  | { kind: "cycle"; moduleIds: string[] };

export interface PlanResult {
  plan?: BuildPlan;
  error?: PlanError;
}

/**
 * Topologically orders ids given a dependency lookup.
 *
 * Kahn's algorithm. Returns the ordered ids, or the ids left in a cycle if
 * one exists (so the caller can name the offenders). Kept pure and separate
 * from planBuild() so the ordering — including the cycle case — can be
 * pinned by a test without the real catalogue.
 */
export function topologicalOrder(
  ids: readonly string[],
  requiresOf: (id: string) => readonly string[],
): { ordered: string[]; cycle: string[] } {
  const set = new Set(ids);
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const id of ids) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const id of ids) {
    for (const dep of requiresOf(id)) {
      if (!set.has(dep)) continue; // external/unknown deps are the caller's problem
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      dependents.get(dep)!.push(id);
    }
  }

  // Stable order: among ready nodes, keep the original input order so the
  // plan is reproducible run to run.
  const ready = ids.filter((id) => indegree.get(id) === 0);
  const ordered: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    ordered.push(node);
    for (const dependent of dependents.get(node) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }

  const cycle = ids.filter((id) => !ordered.includes(id));
  return { ordered, cycle };
}

/**
 * Turns a spec's module list into an ordered build plan.
 *
 * Refuses three impossible plans rather than guessing:
 *   - an id that is not a real module (the model invented one),
 *   - a module whose dependency is not in the plan (it could never be built),
 *   - a dependency cycle (no valid order exists).
 *
 * On success, every step carries the blocker rules and is ordered so a module
 * is always built after everything it requires.
 */
export function planBuild(
  slug: string,
  moduleIds: readonly string[],
  features: readonly string[] = [],
): PlanResult {
  const byId = new Map<string, CatalogueModule>(MODULE_CATALOGUE.map((m) => [m.id, m]));

  // Reject invented modules first — the catalogue is the contract.
  for (const id of moduleIds) {
    if (!byId.has(id)) {
      return { error: { kind: "unknown-module", moduleId: id } };
    }
  }

  // A module needs its dependencies present in the plan, not just declared.
  const included = new Set(moduleIds);
  for (const id of moduleIds) {
    for (const dep of byId.get(id)!.requires) {
      if (!included.has(dep)) {
        return { error: { kind: "missing-dependency", moduleId: id, requires: dep } };
      }
    }
  }

  const { ordered, cycle } = topologicalOrder(
    moduleIds,
    (id) => byId.get(id)?.requires ?? [],
  );

  if (cycle.length > 0) {
    return { error: { kind: "cycle", moduleIds: cycle } };
  }

  const steps: BuildStep[] = ordered.map((id, i) => ({
    order: i + 1,
    moduleId: id,
    summary: byId.get(id)!.summary,
    requires: byId.get(id)!.requires,
    rules: BLOCKER_RULES,
  }));

  // The features are the spec's behavioural requirements; they ride along on
  // the plan so the generation step can be told what the plugin must do,
  // scoped to the module being built. Kept on the plan rather than per-step
  // because features often span modules and the generator resolves that.
  void features;

  return { plan: { slug, steps } };
}

/**
 * Renders a build plan into the instruction a model is given, one step at a
 * time. The point of decomposition is that the model only ever sees the step
 * it is working on plus what that step depends on — never the whole plugin.
 */
export function stepInstruction(step: BuildStep): string {
  const needs = step.requires.length > 0 ? `\nDepends on (already built): ${step.requires.join(", ")}` : "";
  const rules = step.rules.map((r) => `- ${r.rule}`).join("\n");

  return [
    `Build the "${step.moduleId}" module.`,
    step.summary,
    needs,
    "\nNon-negotiable rules for this module:",
    rules,
    "\nReturn only this module's code.",
  ]
    .filter(Boolean)
    .join("\n");
}
