/**
 * Measurable improvement for the agent.
 *
 * "Gets better every day" is a claim until there is a number behind it. This
 * is the number: every caught violation and every recorded fix is logged to
 * agent_events with the rule and the day, and violationTrend() folds them
 * into a per-day series an operator can read. A rule whose violation count
 * trends down as lessons accumulate is the loop working; one that stays flat
 * is a rule the lessons are not reaching, and that is worth knowing.
 *
 * Kept deliberately small — one append-only table and two queries — because
 * the point is a signal, not an analytics warehouse.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentEvents } from "@/lib/db/schema";
import type { RuleSeverity } from "./rules";

export type AgentEventKind = "violation" | "fix";

export interface AgentEventInput {
  ruleId: string;
  severity: RuleSeverity | string;
  kind: AgentEventKind;
  detail?: string;
}

/** Appends one event. Cheap and side-effect-free beyond the insert. */
export async function recordAgentEvent(input: AgentEventInput): Promise<void> {
  await db.insert(agentEvents).values({
    ruleId: input.ruleId,
    severity: String(input.severity),
    kind: input.kind,
    detail: input.detail ?? null,
  });
}

export interface TrendPoint {
  /** Calendar day, YYYY-MM-DD. */
  day: string;
  violations: number;
  fixes: number;
}

/**
 * Per-day violation/fix counts for the last `days` days.
 *
 * Days with no events are omitted rather than zero-filled; the caller can
 * fill gaps for a chart. Ordered oldest-first so the series reads as a
 * trend.
 */
export async function violationTrend(days = 30): Promise<TrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      day: sql<string>`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`,
      kind: agentEvents.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentEvents)
    .where(gte(agentEvents.createdAt, since))
    .groupBy(sql`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`, agentEvents.kind)
    .orderBy(sql`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`);

  const byDay = new Map<string, TrendPoint>();
  for (const row of rows) {
    const point = byDay.get(row.day) ?? { day: row.day, violations: 0, fixes: 0 };
    if (row.kind === "violation") point.violations = row.count;
    else if (row.kind === "fix") point.fixes = row.count;
    byDay.set(row.day, point);
  }

  return [...byDay.values()];
}

/** Which rules are breached most, for targeting the next lesson. */
export async function topViolatedRules(limit = 10): Promise<Array<{ ruleId: string; count: number }>> {
  const rows = await db
    .select({ ruleId: agentEvents.ruleId, count: sql<number>`count(*)::int` })
    .from(agentEvents)
    .where(eq(agentEvents.kind, "violation"))
    .groupBy(agentEvents.ruleId)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ ruleId: r.ruleId, count: r.count }));
}

/** Convenience guard so callers do not import `and` just to combine filters. */
export const eventFilters = { byRule: (ruleId: string) => and(eq(agentEvents.ruleId, ruleId)) };
