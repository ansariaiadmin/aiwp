/**
 * Deterministic in-process gateway used for development, demos, the test
 * suite and CI — it needs no merchant account, no keys and no network.
 *
 * It is deliberately NOT a no-op: `verify()` still demands the exact
 * authority that `create()` issued, and rejects a cancelled or mismatched
 * callback, so the whole order -> redirect -> callback -> provisioning path
 * is exercised end to end exactly as a real gateway would.
 *
 * Selecting it in production is possible but pointless — it hands out paid
 * licenses for free. The admin settings screen labels it as a test gateway.
 */
import type {
  CreatedPayment,
  PaymentGateway,
  PaymentRequest,
  VerificationInput,
  VerificationResult,
} from "./types";

export function mockAuthority(orderReference: string): string {
  return `mock_${orderReference}`;
}

export class MockGateway implements PaymentGateway {
  readonly id = "mock" as const;

  async create(input: PaymentRequest): Promise<CreatedPayment> {
    const authority = mockAuthority(input.orderReference);

    // The "gateway page" is our own /checkout/<orderId> route, which renders
    // a success/cancel choice and then links back to /api/payment/callback.
    const origin = new URL(input.callbackUrl).origin;

    return {
      gatewayRefId: authority,
      redirectUrl: `${origin}/checkout/${input.orderId}?authority=${encodeURIComponent(authority)}`,
    };
  }

  async verify({ params, order }: VerificationInput): Promise<VerificationResult> {
    if (params.status !== "ok") {
      return { ok: false, reason: params.status === "cancel" ? "پرداخت لغو شد." : "وضعیت نامعتبر." };
    }

    const expected = order.gatewayRefId ?? mockAuthority(order.reference);

    if (!params.authority || params.authority !== expected) {
      return { ok: false, reason: "شناسه‌ی تراکنش با این سفارش مطابقت ندارد." };
    }

    return { ok: true, gatewayRefId: expected };
  }
}
