import { requireApiAuth } from "@/lib/api-guard";
import { listOrdersForUser } from "@/lib/commerce";
import { jsonOk } from "@/lib/http";

/** The signed-in customer's own purchase history. Never another user's. */
export async function GET() {
  const guard = await requireApiAuth();
  if (!guard.ok) return guard.response;

  const rows = await listOrdersForUser(guard.session.userId);

  return jsonOk({ orders: rows });
}
