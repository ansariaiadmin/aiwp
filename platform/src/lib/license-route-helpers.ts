import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { consumeRateLimit, licenseApiLimiter, RateLimitExceededError } from "@/lib/rate-limit";
import { licenseRequestBaseSchema, type LicenseRequestBase } from "@/lib/validation/license";

/** Mirrors wp_remote_post()'s default form-encoded body; JSON also accepted. */
export async function parseLicenseRequestBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return {};

  const result: Record<string, string> = {};
  formData.forEach((value, key) => {
    result[key] = String(value);
  });

  return result;
}

export async function withLicenseRequest(
  request: NextRequest,
  handler: (input: LicenseRequestBase, ip: string) => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  const ip = getClientIp(request);

  try {
    await consumeRateLimit(licenseApiLimiter, ip);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
    }
    throw e;
  }

  const body = await parseLicenseRequestBody(request);
  const parsed = licenseRequestBaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 422 },
    );
  }

  const result = await handler(parsed.data, ip);
  return NextResponse.json(result);
}
