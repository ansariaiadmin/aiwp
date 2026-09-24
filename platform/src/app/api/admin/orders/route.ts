import { requireApiAdmin } from "@/lib/api-guard";
import { listAllOrders } from "@/lib/commerce";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const rows = await listAllOrders(200);

  return jsonOk({ orders: rows });
}
