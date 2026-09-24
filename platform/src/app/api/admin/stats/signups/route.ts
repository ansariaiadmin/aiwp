import { requireApiAdmin } from "@/lib/api-guard";
import { getSignupSeries } from "@/lib/stats";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const series = await getSignupSeries(14);
  return jsonOk({ series });
}
