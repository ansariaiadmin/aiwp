/**
 * Model profiles and capability-aware routing.
 *
 * The factory has tasks of very different difficulty. Deciding which plugin
 * modules a feature needs is a small classification problem; writing a whole
 * module's PHP is not. Sending both to the largest available model is the
 * single easiest way to make the platform expensive and slow for no gain.
 *
 * A task declares the capability it needs; the router picks the cheapest
 * model from the configured provider that clears the bar and has enough
 * context. Nothing here hardcodes a vendor — the bar is expressed against
 * the provider's own model list, so a self-hosted Qwen endpoint and a hosted
 * frontier model both work.
 */

import type { LlmModel } from "./types";

/** Capability tiers, lowest to highest. */
export const CAPABILITY = {
  /** Classification, extraction, short rewrites. */
  LIGHT: 1,
  /** Summarisation, structured spec generation, code review comments. */
  MEDIUM: 2,
  /** Generating or substantially editing source code. */
  HEAVY: 3,
} as const;

export type CapabilityTier = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/** The tasks the platform actually asks a model to do. */
export const TASKS = {
  /** Pick which factory modules a feature description needs. */
  classifyModules: { capability: CAPABILITY.LIGHT, maxInputTokens: 4_000 },
  /** Turn a feature description into a plugin spec (JSON). */
  draftSpec: { capability: CAPABILITY.MEDIUM, maxInputTokens: 16_000, json: true },
  /** Review a composed module for security and WPCS issues. */
  reviewCode: { capability: CAPABILITY.MEDIUM, maxInputTokens: 32_000 },
  /** Generate or rewrite module source. */
  writeCode: { capability: CAPABILITY.HEAVY, maxInputTokens: 64_000 },
  /** Explain a build failure to the operator. */
  explainFailure: { capability: CAPABILITY.LIGHT, maxInputTokens: 8_000 },
} as const;

export type TaskId = keyof typeof TASKS;

export interface TaskRequirements {
  capability: CapabilityTier;
  maxInputTokens: number;
  json?: boolean;
}

export interface RoutedModel {
  model: LlmModel;
  /** Set when no model cleared the bar and we fell back to the best available. */
  downgraded: boolean;
}

/**
 * Chooses a model for a task from what the configured provider offers.
 *
 * Never throws: a caller that asked for HEAVY on a small self-hosted model
 * still gets the best thing available, with `downgraded` set so the caller
 * can warn the operator instead of failing the job outright.
 */
export function routeModel(
  models: readonly LlmModel[],
  task: TaskRequirements,
  preferredId?: string | null,
): RoutedModel | null {
  if (models.length === 0) return null;

  // An explicit admin choice always wins — they may know something the
  // capability numbers do not, or be pinned to a model for cost reasons.
  if (preferredId) {
    const preferred = models.find((m) => m.id === preferredId);
    if (preferred) return { model: preferred, downgraded: false };
  }

  const candidates = models
    .filter(
      (m) =>
        m.capability >= task.capability &&
        m.contextTokens >= task.maxInputTokens &&
        (!task.json || m.supportsJson),
    )
    // Cheapest first; among equals, the more capable one.
    .sort((a, b) => a.cost - b.cost || b.capability - a.capability);

  if (candidates.length > 0) {
    return { model: candidates[0], downgraded: false };
  }

  // Nothing clears the bar. Take the most capable model that at least fits
  // the context and JSON requirements, so the job still runs.
  const bestEffort = [...models]
    .filter((m) => m.contextTokens >= task.maxInputTokens && (!task.json || m.supportsJson))
    .sort((a, b) => b.capability - a.capability);

  if (bestEffort.length > 0) {
    return { model: bestEffort[0], downgraded: true };
  }

  // Even context does not fit anywhere; hand back the largest model and let
  // the caller decide whether to truncate or abort.
  const largest = [...models].sort((a, b) => b.contextTokens - a.contextTokens)[0];
  return { model: largest, downgraded: true };
}
