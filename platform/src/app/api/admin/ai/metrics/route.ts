import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { jsonOk } from "@/lib/http";
import { violationTrend, topViolatedRules } from "@/lib/ai/metrics";
import { rulesetSummary } from "@/lib/ai/lessons";

/**
 * GET /api/admin/ai/metrics?days=30
 *
 * The measurable half of "gets better every day": the per-day violation/fix
 * trend, the most-breached rules, and the ruleset the agent is held to. A
 * rule whose violations trend down as lessons accumulate is the loop
 * working; one that stays flat is a lesson that is not landing.
 */
export async function GET(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30;

  const [trend, topRules] = await Promise.all([
    violationTrend(days),
    topViolatedRules(10),
  ]);

  return jsonOk({ days, ruleset: rulesetSummary(), trend, topRules });
}
