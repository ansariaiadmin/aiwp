import { requireApiAdmin } from "@/lib/api-guard";
import { getRecentAuditLogs } from "@/lib/stats";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const logs = await getRecentAuditLogs(100);

  return jsonOk({ logs });
}
