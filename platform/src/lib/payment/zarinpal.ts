/**
 * ZarinPal (زرین‌پال) driver — Payment Gateway v4 JSON API.
 *
 *   POST {base}/payment/request.json  -> { data: { code, authority } }
 *   redirect to {payBase}/pg/StartPay/{authority}
 *   buyer returns to callback_url?Status=OK&Authority={authority}
 *   POST {base}/payment/verify.json   -> { data: { code, ref_id } }
 *
 * `fetch` is injectable so this can be unit-tested without a merchant
 * account or network access.
 *
 * IMPORTANT — money unit: ZarinPal's `amount` field is denominated in
 * TOMAN, while this platform stores IRR prices in RIAL (see
 * productPlans.price). tomanAmount() performs that conversion in one place
 * and refuses to guess for an unknown currency.
 */
import type {
  CreatedPayment,
  FetchLike,
  PaymentGateway,
  PaymentRequest,
  VerificationInput,
  VerificationResult,
} from "./types";

const PROD_API = "https://api.zarinpal.com/pg/v4";
const SANDBOX_API = "https://sandbox.zarinpal.com/pg/v4";
const PROD_PAY = "https://www.zarinpal.com/pg/StartPay";
const SANDBOX_PAY = "https://sandbox.zarinpal.com/pg/StartPay";

/** Converts a stored amount into the Toman integer ZarinPal expects. */
export function tomanAmount(amount: number, currency: string): number {
  const upper = currency.toUpperCase();

  if (upper === "TMN" || upper === "TOMAN" || upper === "IRT") return Math.round(amount);
  if (upper === "IRR") return Math.round(amount / 10);

  throw new Error(
    `ZarinPal only supports Iranian currencies; cannot convert "${currency}" to Toman.`,
  );
}

export interface ZarinpalOptions {
  merchantId: string;
  sandbox?: boolean;
  fetchImpl?: FetchLike;
}

interface ZarinpalResponse {
  data?: { code?: number; authority?: string; ref_id?: number; message?: string };
  errors?: { code?: number; message?: string } | unknown;
}

export class ZarinpalGateway implements PaymentGateway {
  readonly id = "zarinpal" as const;

  private readonly merchantId: string;
  private readonly apiBase: string;
  private readonly payBase: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ZarinpalOptions) {
    if (!options.merchantId) {
      throw new Error("ZarinPal merchant id is not configured.");
    }

    this.merchantId = options.merchantId;
    this.apiBase = options.sandbox ? SANDBOX_API : PROD_API;
    this.payBase = options.sandbox ? SANDBOX_PAY : PROD_PAY;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit));
  }

  async create(input: PaymentRequest): Promise<CreatedPayment> {
    const response = await this.fetchImpl(`${this.apiBase}/payment/request.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: tomanAmount(input.amount, input.currency),
        callback_url: input.callbackUrl,
        description: input.description,
        metadata: { email: input.buyerEmail, order: input.orderReference },
      }),
    });

    const body = (await safeJson(response.text())) as ZarinpalResponse;
    const authority = body.data?.authority;

    if (response.status !== 200 || body.data?.code !== 100 || !authority) {
      const message = describeZarinpalError(body) ?? `HTTP ${response.status}`;
      throw new Error(`ZarinPal could not create the payment: ${message}`);
    }

    return {
      gatewayRefId: authority,
      redirectUrl: `${this.payBase}/${encodeURIComponent(authority)}`,
    };
  }

  async verify({ params, order }: VerificationInput): Promise<VerificationResult> {
    const status = params.Status ?? params.status;
    const authority = params.Authority ?? params.authority;

    if (!status || status.toUpperCase() !== "OK") {
      return { ok: false, reason: "پرداخت در سمت زرین‌پال تأیید نشد یا لغو شده است." };
    }

    if (!authority || authority !== order.gatewayRefId) {
      return { ok: false, reason: "شناسه‌ی تراکنش با این سفارش مطابقت ندارد." };
    }

    const response = await this.fetchImpl(`${this.apiBase}/payment/verify.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        authority,
        amount: tomanAmount(order.amount, order.currency),
      }),
    });

    const body = (await safeJson(response.text())) as ZarinpalResponse;

    // code 100 = success, 101 = already verified (treat as success so a
    // duplicated callback never marks a genuinely paid order as failed).
    if (response.status !== 200 || (body.data?.code !== 100 && body.data?.code !== 101)) {
      const message = describeZarinpalError(body) ?? `HTTP ${response.status}`;
      return { ok: false, reason: `زرین‌پال تراکنش را تأیید نکرد: ${message}` };
    }

    return { ok: true, gatewayRefId: String(body.data?.ref_id ?? authority) };
  }
}

async function safeJson(text: Promise<string>): Promise<unknown> {
  try {
    return JSON.parse(await text);
  } catch {
    return null;
  }
}

function describeZarinpalError(body: ZarinpalResponse | null): string | null {
  if (!body) return null;

  const errors = body.errors as { code?: number; message?: string } | undefined;
  if (errors && typeof errors === "object" && "message" in errors && errors.message) {
    return `${errors.message} (code ${errors.code ?? "?"})`;
  }

  return body.data?.message ?? null;
}
