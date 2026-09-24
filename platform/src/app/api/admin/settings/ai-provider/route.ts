import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guard";
import { getAiProviderConfigMasked, setAiProviderConfig } from "@/lib/settings";
import { aiProviderSchema } from "@/lib/validation/settings";
import { jsonError, jsonOk, zodErrorMessage, getClientIp } from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import type { AiProviderId } from "@/lib/settings";

export async function GET() {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const config = await getAiProviderConfigMasked();
  return jsonOk({ config });
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = aiProviderSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(zodErrorMessage(parsed.error), 422);
  }

  await setAiProviderConfig(
    {
      provider: parsed.data.provider as AiProviderId,
      apiKey: parsed.data.apiKey || undefined,
      model: parsed.data.model,
      baseUrl: parsed.data.baseUrl || undefined,
    },
    guard.session.userId,
  );

  await recordAuditLog({
    actorId: guard.session.userId,
    action: "settings.ai_provider.updated",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { provider: parsed.data.provider, model: parsed.data.model },
  });

  return jsonOk({ message: "تنظیمات هوش مصنوعی با موفقیت ذخیره شد." });
}
