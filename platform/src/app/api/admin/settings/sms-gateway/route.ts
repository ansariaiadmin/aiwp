import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { getSmsGatewayConfigMasked, setSmsGatewayConfig } from "@/lib/settings";
import { smsGatewaySchema } from "@/lib/validation/settings";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import type { SmsDriverId } from "@/lib/settings";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const config = await getSmsGatewayConfigMasked();
  return jsonOk({ config });
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = smsGatewaySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  await setSmsGatewayConfig(
    {
      driver: parsed.data.driver as SmsDriverId,
      apiKey: parsed.data.apiKey || undefined,
      sender: parsed.data.sender || undefined,
    },
    guard.session.userId,
  );

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "settings.sms_gateway.updated",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { driver: parsed.data.driver },
  });

  return jsonOk({ message: "تنظیمات پنل پیامک با موفقیت ذخیره شد." });
}
