/**
 * Platform settings service: AI provider config (so the "agent" can be
 * pointed at any provider/model) and SMS gateway config (mirrors
 * modules/sms-gateway's two drivers). Every value is encrypted at rest
 * with AES-256-GCM (see lib/crypto.ts) and only ever decrypted in server
 * code, never sent to the client in cleartext.
 */
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { PAYMENT_GATEWAYS, type PaymentGatewayId } from "@/lib/payment/types";

export type SettingCategory =
  | "AI_PROVIDER"
  | "SMS_GATEWAY"
  | "GENERAL"
  | "EMAIL"
  | "PAYMENT";

export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4.1" },
  { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4.5" },
  { id: "google", label: "Google Gemini", defaultModel: "gemini-2.5-pro" },
  { id: "openrouter", label: "OpenRouter (any model)", defaultModel: "openrouter/auto" },
  { id: "custom", label: "سفارشی (Custom OpenAI-compatible endpoint)", defaultModel: "" },
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

export const SMS_DRIVERS = [
  { id: "kavenegar", label: "Kavenegar" },
  { id: "melipayamak", label: "MeliPayamak" },
] as const;

export type SmsDriverId = (typeof SMS_DRIVERS)[number]["id"];

async function getSetting(category: SettingCategory, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(platformSettings)
    .where(and(eq(platformSettings.category, category), eq(platformSettings.key, key)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (!row.isSecret) return row.valueEncrypted;

  // A secret that cannot be decrypted is treated as absent rather than
  // thrown. The realistic cause is ENCRYPTION_KEY having changed while the
  // database persisted — every stored secret then fails AES-GCM
  // authentication at once. Propagating that made every admin page reading
  // any setting return 500, so a single stale key took down the whole panel
  // with no way to re-enter the key through the UI. Returning null lets the
  // operator simply save a new one.
  try {
    return decryptSecret(row.valueEncrypted);
  } catch (error) {
    logger.error(
      { category, key, error: error instanceof Error ? error.message : String(error) },
      "Could not decrypt a stored secret; treating it as unset. " +
        "This usually means ENCRYPTION_KEY changed after the value was stored.",
    );

    return null;
  }
}

async function setSetting(
  category: SettingCategory,
  key: string,
  value: string,
  options: { isSecret?: boolean; updatedById?: string } = {},
): Promise<void> {
  const isSecret = options.isSecret ?? true;
  const stored = isSecret ? encryptSecret(value) : value;

  await db
    .insert(platformSettings)
    .values({
      category,
      key,
      valueEncrypted: stored,
      isSecret,
      updatedById: options.updatedById,
    })
    .onConflictDoUpdate({
      target: [platformSettings.category, platformSettings.key],
      set: { valueEncrypted: stored, isSecret, updatedById: options.updatedById },
    });
}

// ---------------------------------------------------------------------------
// AI provider settings
// ---------------------------------------------------------------------------

export interface AiProviderConfig {
  provider: AiProviderId;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

export async function getAiProviderConfig(): Promise<AiProviderConfig> {
  const [provider, apiKey, model, baseUrl] = await Promise.all([
    getSetting("AI_PROVIDER", "provider"),
    getSetting("AI_PROVIDER", "api_key"),
    getSetting("AI_PROVIDER", "model"),
    getSetting("AI_PROVIDER", "base_url"),
  ]);

  return {
    provider: (provider as AiProviderId) ?? "openai",
    apiKey,
    model: model ?? AI_PROVIDERS[0].defaultModel,
    baseUrl,
  };
}

export async function getAiProviderConfigMasked() {
  const config = await getAiProviderConfig();
  return {
    ...config,
    apiKey: config.apiKey ? maskSecret(config.apiKey) : null,
    apiKeySet: Boolean(config.apiKey),
  };
}

export async function setAiProviderConfig(
  input: { provider: AiProviderId; apiKey?: string; model: string; baseUrl?: string },
  updatedById: string,
): Promise<void> {
  await setSetting("AI_PROVIDER", "provider", input.provider, {
    isSecret: false,
    updatedById,
  });
  await setSetting("AI_PROVIDER", "model", input.model, { isSecret: false, updatedById });

  if (input.baseUrl !== undefined) {
    await setSetting("AI_PROVIDER", "base_url", input.baseUrl, {
      isSecret: false,
      updatedById,
    });
  }

  if (input.apiKey) {
    await setSetting("AI_PROVIDER", "api_key", input.apiKey, { isSecret: true, updatedById });
  }
}

// ---------------------------------------------------------------------------
// SMS gateway settings
// ---------------------------------------------------------------------------

export interface SmsGatewayConfig {
  driver: SmsDriverId;
  apiKey: string | null;
  sender: string | null;
}

export async function getSmsGatewayConfig(): Promise<SmsGatewayConfig> {
  const [driver, apiKey, sender] = await Promise.all([
    getSetting("SMS_GATEWAY", "driver"),
    getSetting("SMS_GATEWAY", "api_key"),
    getSetting("SMS_GATEWAY", "sender"),
  ]);

  return {
    driver: (driver as SmsDriverId) ?? "kavenegar",
    apiKey,
    sender,
  };
}

export async function getSmsGatewayConfigMasked() {
  const config = await getSmsGatewayConfig();
  return {
    ...config,
    apiKey: config.apiKey ? maskSecret(config.apiKey) : null,
    apiKeySet: Boolean(config.apiKey),
  };
}

export async function setSmsGatewayConfig(
  input: { driver: SmsDriverId; apiKey?: string; sender?: string },
  updatedById: string,
): Promise<void> {
  await setSetting("SMS_GATEWAY", "driver", input.driver, { isSecret: false, updatedById });

  if (input.sender !== undefined) {
    await setSetting("SMS_GATEWAY", "sender", input.sender, { isSecret: false, updatedById });
  }

  if (input.apiKey) {
    await setSetting("SMS_GATEWAY", "api_key", input.apiKey, { isSecret: true, updatedById });
  }
}

// ---------------------------------------------------------------------------
// Payment gateway settings
// ---------------------------------------------------------------------------

export interface PaymentConfig {
  gateway: PaymentGatewayId;
  currency: string;
  zarinpalMerchantId: string | null;
  zarinpalSandbox: boolean;
  stripeSecretKey: string | null;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const gateway = await getSetting("PAYMENT", "gateway");
  const currency = await getSetting("PAYMENT", "currency");
  const merchantId = await getSetting("PAYMENT", "zarinpal_merchant_id");
  const sandbox = await getSetting("PAYMENT", "zarinpal_sandbox");
  const stripeKey = await getSetting("PAYMENT", "stripe_secret_key");

  const known = PAYMENT_GATEWAYS.some((g) => g.id === gateway);

  return {
    // Defaults to the keyless test gateway so a fresh install is demoable
    // rather than broken; an admin must explicitly pick a real gateway.
    gateway: (known ? gateway : "mock") as PaymentGatewayId,
    currency: currency || "IRR",
    zarinpalMerchantId: merchantId || null,
    zarinpalSandbox: sandbox === "true",
    stripeSecretKey: stripeKey || null,
  };
}

export async function getPaymentConfigMasked() {
  const config = await getPaymentConfig();

  return {
    gateway: config.gateway,
    currency: config.currency,
    zarinpalSandbox: config.zarinpalSandbox,
    zarinpalMerchantId: config.zarinpalMerchantId
      ? maskSecret(config.zarinpalMerchantId)
      : null,
    stripeSecretKey: config.stripeSecretKey ? maskSecret(config.stripeSecretKey) : null,
  };
}

export async function setPaymentConfig(
  input: {
    gateway: PaymentGatewayId;
    currency?: string;
    zarinpalMerchantId?: string;
    zarinpalSandbox?: boolean;
    stripeSecretKey?: string;
  },
  updatedById: string,
): Promise<void> {
  await setSetting("PAYMENT", "gateway", input.gateway, { isSecret: false, updatedById });

  if (input.currency !== undefined) {
    await setSetting("PAYMENT", "currency", input.currency, {
      isSecret: false,
      updatedById,
    });
  }

  if (input.zarinpalSandbox !== undefined) {
    await setSetting("PAYMENT", "zarinpal_sandbox", String(input.zarinpalSandbox), {
      isSecret: false,
      updatedById,
    });
  }

  // Same convention as the AI/SMS credentials: an empty value means "leave
  // the stored secret alone", so a settings form that does not re-type the
  // key never wipes it.
  if (input.zarinpalMerchantId) {
    await setSetting("PAYMENT", "zarinpal_merchant_id", input.zarinpalMerchantId, {
      isSecret: true,
      updatedById,
    });
  }

  if (input.stripeSecretKey) {
    await setSetting("PAYMENT", "stripe_secret_key", input.stripeSecretKey, {
      isSecret: true,
      updatedById,
    });
  }
}
