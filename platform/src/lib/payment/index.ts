import { getPaymentConfig, type PaymentConfig } from "@/lib/settings";
import { MockGateway } from "./mock";
import { StripeGateway } from "./stripe";
import { ZarinpalGateway } from "./zarinpal";
import type { FetchLike, PaymentGateway } from "./types";

export { PAYMENT_GATEWAYS, type PaymentGatewayId } from "./types";

/**
 * Builds the driver for a resolved config. Split out from getActiveGateway()
 * so tests can construct any gateway without touching the database.
 *
 * Throws with an actionable message when a real gateway is selected but its
 * credentials are missing — failing loudly at checkout is far better than
 * silently falling back to the free test gateway and giving products away.
 */
export function resolvePaymentGateway(
  config: Pick<
    PaymentConfig,
    "gateway" | "zarinpalMerchantId" | "zarinpalSandbox" | "stripeSecretKey"
  >,
  fetchImpl?: FetchLike,
): PaymentGateway {
  switch (config.gateway) {
    case "zarinpal":
      if (!config.zarinpalMerchantId) {
        throw new Error(
          "درگاه زرین‌پال انتخاب شده ولی Merchant ID در تنظیمات پرداخت وارد نشده است.",
        );
      }
      return new ZarinpalGateway({
        merchantId: config.zarinpalMerchantId,
        sandbox: config.zarinpalSandbox,
        fetchImpl,
      });

    case "stripe":
      if (!config.stripeSecretKey) {
        throw new Error(
          "درگاه Stripe انتخاب شده ولی کلید مخفی در تنظیمات پرداخت وارد نشده است.",
        );
      }
      return new StripeGateway({ secretKey: config.stripeSecretKey, fetchImpl });

    case "mock":
      return new MockGateway();

    default: {
      const exhaustive: never = config.gateway;
      throw new Error(`Unknown payment gateway: ${String(exhaustive)}`);
    }
  }
}

/** The gateway the platform is currently configured to charge with. */
export async function getActiveGateway(): Promise<{
  gateway: PaymentGateway;
  config: PaymentConfig;
}> {
  const config = await getPaymentConfig();

  return { gateway: resolvePaymentGateway(config), config };
}
