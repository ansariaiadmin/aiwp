import { NextRequest } from "next/server";
import { getCurrentSession, revokeCurrentSession } from "@/lib/auth/session";
import { jsonOk, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  await revokeCurrentSession();

  if (session) {
    await recordAuditLog({
      actorId: session.userId,
      action: "auth.logout",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  }

  return jsonOk({ message: "خروج انجام شد." });
}
