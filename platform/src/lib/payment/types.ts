/**
 * Payment gateway contract.
 *
 * Every driver takes an injectable `fetch` so the request/response handling
 * can be unit-tested without network access or live merchant credentials
 * (see src/lib/__tests__/payment.test.ts). Production callers pass nothing
 * and get the global fetch.
 *
 * Security model: `create()` only ever produces a redirect; it never grants
 * anything. A license is provisioned exclusively by `settleOrder()` after
 * `verify()` returns ok — see src/lib/commerce.ts.
 */

export const PAYMENT_GATEWAYS = [
  { id: "mock", label: "درگاه آزمایشی (بدون نیاز به کلید)" },
  { id: "zarinpal", label: "زرین‌پال" },
  { id: "stripe", label: "Stripe Checkout" },
] as const;

export type PaymentGatewayId = (typeof PAYMENT_GATEWAYS)[number]["id"];

export interface PaymentRequest {
  orderId: string;
  /** Our own order number, echoed back on the callback. */
  orderReference: string;
  /** Smallest currency unit — see productPlans.price in the schema. */
  amount: number;
  currency: string;
  description: string;
  buyerEmail: string;
  /** Absolute URL the gateway must return the buyer to. */
  callbackUrl: string;
}

export interface CreatedPayment {
  gatewayRefId: string;
  redirectUrl: string;
}

export interface OrderForVerification {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  gatewayRefId: string | null;
}

export interface VerificationInput {
  /** Raw query parameters exactly as the gateway sent them. */
  params: Record<string, string | undefined>;
  order: OrderForVerification;
}

export type VerificationResult =
  | { ok: true; gatewayRefId: string }
  | { ok: false; reason: string };

export interface PaymentGateway {
  readonly id: PaymentGatewayId;
  create(input: PaymentRequest): Promise<CreatedPayment>;
  verify(input: VerificationInput): Promise<VerificationResult>;
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; text(): Promise<string> }>;
