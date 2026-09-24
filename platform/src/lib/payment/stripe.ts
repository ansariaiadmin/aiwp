/**
 * Stripe Checkout driver.
 *
 *   POST /v1/checkout/sessions          -> { id, url }
 *   buyer pays on Stripe's hosted page
 *   returns to success_url?session_id={CHECKOUT_SESSION_ID}
 *   GET  /v1/checkout/sessions/{id}     -> { payment_status: "paid", amount_total }
 *
 * We deliberately use Stripe-hosted Checkout rather than the Elements flow:
 * no card data ever touches this server, so the deployment stays out of
 * PCI DSS scope.
 *
 * `fetch` is injectable so this can be unit-tested without an account.
 *
 * IMPORTANT — money unit: Stripe's `unit_amount` / `amount_total` are in the
 * currency's smallest unit (USD cents), which is exactly how this platform
 * stores non-IRR prices (see productPlans.price).
 */
import type {
  CreatedPayment,
  FetchLike,
  PaymentGateway,
  PaymentRequest,
  VerificationInput,
  VerificationResult,
} from "./types";

const API_BASE = "https://api.stripe.com/v1";

export interface StripeOptions {
  secretKey: string;
  fetchImpl?: FetchLike;
}

interface CheckoutSession {
  id?: string;
  url?: string | null;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  error?: { message?: string };
}

export class StripeGateway implements PaymentGateway {
  readonly id = "stripe" as const;

  private readonly authHeader: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: StripeOptions) {
    if (!options.secretKey) {
      throw new Error("Stripe secret key is not configured.");
    }

    this.authHeader = `Basic ${Buffer.from(`${options.secretKey}:`).toString("base64")}`;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit));
  }

  async create(input: PaymentRequest): Promise<CreatedPayment> {
    const origin = new URL(input.callbackUrl).origin;
    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: input.orderReference,
      customer_email: input.buyerEmail,
      success_url: `${input.callbackUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${input.orderId}?canceled=1`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amount),
      "line_items[0][price_data][product_data][name]": input.description,
    });

    const response = await this.fetchImpl(`${API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const body = (await safeJson(response.text())) as CheckoutSession | null;

    if (response.status !== 200 || !body?.id || !body.url) {
      throw new Error(
        `Stripe could not create a checkout session: ${body?.error?.message ?? `HTTP ${response.status}`}`,
      );
    }

    return { gatewayRefId: body.id, redirectUrl: body.url };
  }

  async verify({ params, order }: VerificationInput): Promise<VerificationResult> {
    const sessionId = params.session_id;

    if (!sessionId) {
      return { ok: false, reason: "شناسه‌ی نشست Stripe برگردانده نشد." };
    }

    if (order.gatewayRefId && sessionId !== order.gatewayRefId) {
      return { ok: false, reason: "شناسه‌ی نشست با این سفارش مطابقت ندارد." };
    }

    const response = await this.fetchImpl(
      `${API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { method: "GET", headers: { Authorization: this.authHeader } },
    );

    const body = (await safeJson(response.text())) as CheckoutSession | null;

    if (response.status !== 200 || !body?.id) {
      return { ok: false, reason: `Stripe پاسخ معتبر نداد (${response.status}).` };
    }

    if (body.payment_status !== "paid") {
      return { ok: false, reason: `پرداخت کامل نشده است (وضعیت: ${body.payment_status ?? "نامشخص"}).` };
    }

    // Never trust the redirect alone: the amount Stripe actually charged
    // must equal the amount this order was created for.
    if (typeof body.amount_total === "number" && body.amount_total !== order.amount) {
      return {
        ok: false,
        reason: `مبلغ پرداختی (${body.amount_total}) با مبلغ سفارش (${order.amount}) یکی نیست.`,
      };
    }

    return { ok: true, gatewayRefId: body.id };
  }
}

async function safeJson(text: Promise<string>): Promise<unknown> {
  try {
    return JSON.parse(await text);
  } catch {
    return null;
  }
}
