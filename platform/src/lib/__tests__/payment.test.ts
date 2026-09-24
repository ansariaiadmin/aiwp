import { describe, expect, it } from "vitest";
import { resolvePaymentGateway } from "@/lib/payment";
import { MockGateway, mockAuthority } from "@/lib/payment/mock";
import { tomanAmount, ZarinpalGateway } from "@/lib/payment/zarinpal";
import { StripeGateway } from "@/lib/payment/stripe";
import { formatAmount, formatPriceWithToman } from "@/lib/money";
import { newOrderReference, orderCallbackUrl } from "@/lib/commerce";
import type { FetchLike } from "@/lib/payment/types";

/** A scripted fetch stub: records what was sent and replays canned bodies. */
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { status, text: async () => JSON.stringify(body) };
  };

  return { impl, calls };
}

/** An order as ZarinPal would have left it (authority from the gateway). */
const ORDER = {
  id: "ord_1",
  reference: "AW-260907-ABCDE",
  amount: 1_500_000,
  currency: "IRR",
  gatewayRefId: "A00000XYZ",
};

/** The same order as the mock gateway would have left it. */
const MOCK_ORDER = { ...ORDER, gatewayRefId: mockAuthority(ORDER.reference) };

describe("resolvePaymentGateway", () => {
  it("returns the keyless mock gateway without any configuration", () => {
    const gateway = resolvePaymentGateway({
      gateway: "mock",
      zarinpalMerchantId: null,
      zarinpalSandbox: false,
      stripeSecretKey: null,
    });

    expect(gateway).toBeInstanceOf(MockGateway);
  });

  it("refuses to silently fall back to mock when a real gateway lacks credentials", () => {
    expect(() =>
      resolvePaymentGateway({
        gateway: "zarinpal",
        zarinpalMerchantId: null,
        zarinpalSandbox: false,
        stripeSecretKey: null,
      }),
    ).toThrow(/Merchant ID/);

    expect(() =>
      resolvePaymentGateway({
        gateway: "stripe",
        zarinpalMerchantId: null,
        zarinpalSandbox: false,
        stripeSecretKey: null,
      }),
    ).toThrow(/کلید مخفی/);
  });

  it("builds the requested driver once credentials are present", () => {
    expect(
      resolvePaymentGateway({
        gateway: "zarinpal",
        zarinpalMerchantId: "m-123",
        zarinpalSandbox: true,
        stripeSecretKey: null,
      }),
    ).toBeInstanceOf(ZarinpalGateway);

    expect(
      resolvePaymentGateway({
        gateway: "stripe",
        zarinpalMerchantId: null,
        zarinpalSandbox: false,
        stripeSecretKey: "sk_test_1",
      }),
    ).toBeInstanceOf(StripeGateway);
  });
});

describe("MockGateway", () => {
  const gateway = new MockGateway();

  it("redirects to our own simulated gateway page carrying the authority", async () => {
    const created = await gateway.create({
      orderId: "ord_1",
      orderReference: ORDER.reference,
      amount: ORDER.amount,
      currency: "IRR",
      description: "AiWp — Regular",
      buyerEmail: "buyer@example.com",
      callbackUrl: "http://localhost:3000/api/payment/callback?order=AW-260907-ABCDE",
    });

    expect(created.gatewayRefId).toBe(mockAuthority(ORDER.reference));
    expect(created.redirectUrl).toBe(
      `http://localhost:3000/checkout/ord_1?authority=${mockAuthority(ORDER.reference)}`,
    );
  });

  it("accepts a matching ok callback and rejects everything else", async () => {
    const authority = mockAuthority(ORDER.reference);

    expect(
      await gateway.verify({ params: { status: "ok", authority }, order: MOCK_ORDER }),
    ).toEqual({ ok: true, gatewayRefId: authority });

    expect(
      (await gateway.verify({ params: { status: "cancel", authority }, order: MOCK_ORDER })).ok,
    ).toBe(false);

    // A forged authority must not settle the order.
    expect(
      (await gateway.verify({ params: { status: "ok", authority: "mock_GUESSED" }, order: MOCK_ORDER }))
        .ok,
    ).toBe(false);

    expect((await gateway.verify({ params: { status: "ok" }, order: MOCK_ORDER })).ok).toBe(false);
  });

  it("falls back to a derived authority when the order has none stored yet", async () => {
    const authority = mockAuthority(ORDER.reference);
    const pending = { ...ORDER, gatewayRefId: null };

    expect(
      await gateway.verify({ params: { status: "ok", authority }, order: pending }),
    ).toEqual({ ok: true, gatewayRefId: authority });
  });
});

describe("tomanAmount", () => {
  it("converts Rial to Toman and passes Toman through unchanged", () => {
    expect(tomanAmount(1_500_000, "IRR")).toBe(150_000);
    expect(tomanAmount(150_000, "TMN")).toBe(150_000);
  });

  it("refuses to guess a conversion for a foreign currency", () => {
    expect(() => tomanAmount(4900, "USD")).toThrow(/Iranian currencies/);
  });
});

describe("ZarinpalGateway", () => {
  it("creates a payment and returns the StartPay redirect", async () => {
    const { impl, calls } = stubFetch(200, {
      data: { code: 100, authority: "A00000XYZ" },
      errors: [],
    });

    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });
    const created = await gateway.create({
      orderId: "ord_1",
      orderReference: ORDER.reference,
      amount: 1_500_000,
      currency: "IRR",
      description: "AiWp — Regular",
      buyerEmail: "buyer@example.com",
      callbackUrl: "https://shop.example.com/api/payment/callback?order=AW-260907-ABCDE",
    });

    expect(created.gatewayRefId).toBe("A00000XYZ");
    expect(created.redirectUrl).toBe("https://www.zarinpal.com/pg/StartPay/A00000XYZ");

    // The amount sent to the gateway must be Toman, not Rial.
    const sent = JSON.parse(calls[0].init?.body ?? "{}");
    expect(sent.amount).toBe(150_000);
    expect(sent.merchant_id).toBe("m-123");
    expect(calls[0].url).toBe("https://api.zarinpal.com/pg/v4/payment/request.json");
  });

  it("uses the sandbox endpoints when configured", async () => {
    const { impl, calls } = stubFetch(200, { data: { code: 100, authority: "A00000XYZ" } });

    const gateway = new ZarinpalGateway({ merchantId: "m-123", sandbox: true, fetchImpl: impl });
    const created = await gateway.create({
      orderId: "ord_1",
      orderReference: ORDER.reference,
      amount: 1_500_000,
      currency: "IRR",
      description: "d",
      buyerEmail: "b@e.com",
      callbackUrl: "https://shop.example.com/cb",
    });

    expect(calls[0].url).toBe("https://sandbox.zarinpal.com/pg/v4/payment/request.json");
    expect(created.redirectUrl).toBe("https://sandbox.zarinpal.com/pg/StartPay/A00000XYZ");
  });

  it("throws with the gateway's own message when the request is refused", async () => {
    const { impl } = stubFetch(200, {
      data: {},
      errors: { code: -9, message: "خطای اعتبارسنجی" },
    });

    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    await expect(
      gateway.create({
        orderId: "ord_1",
        orderReference: ORDER.reference,
        amount: 1_500_000,
        currency: "IRR",
        description: "d",
        buyerEmail: "b@e.com",
        callbackUrl: "https://shop.example.com/cb",
      }),
    ).rejects.toThrow(/خطای اعتبارسنجی/);
  });

  it("rejects a callback whose Status is not OK, without calling the API", async () => {
    const { impl, calls } = stubFetch(200, { data: { code: 100, ref_id: 42 } });
    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    const result = await gateway.verify({ params: { Status: "NOK", Authority: "A00000XYZ" }, order: ORDER });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("rejects an authority that does not belong to this order", async () => {
    const { impl } = stubFetch(200, { data: { code: 100, ref_id: 42 } });
    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    const result = await gateway.verify({
      params: { Status: "OK", Authority: "A-SOMEONE-ELSES" },
      order: ORDER,
    });

    expect(result.ok).toBe(false);
  });

  it("verifies a real transaction and returns the ref_id", async () => {
    const { impl, calls } = stubFetch(200, { data: { code: 100, ref_id: 987654 } });
    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    const result = await gateway.verify({
      params: { Status: "OK", Authority: "A00000XYZ" },
      order: ORDER,
    });

    expect(result).toEqual({ ok: true, gatewayRefId: "987654" });
    expect(calls[0].url).toBe("https://api.zarinpal.com/pg/v4/payment/verify.json");
    expect(JSON.parse(calls[0].init?.body ?? "{}").amount).toBe(150_000);
  });

  it("treats code 101 (already verified) as success so retries cannot fail a paid order", async () => {
    const { impl } = stubFetch(200, { data: { code: 101, message: "قبلاً تایید شده" } });
    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    const result = await gateway.verify({
      params: { Status: "OK", Authority: "A00000XYZ" },
      order: ORDER,
    });

    expect(result.ok).toBe(true);
  });

  it("reports failure when the verify call is refused", async () => {
    const { impl } = stubFetch(200, {
      data: {},
      errors: { code: -101, message: "تراکنش ناموفق" },
    });
    const gateway = new ZarinpalGateway({ merchantId: "m-123", fetchImpl: impl });

    const result = await gateway.verify({
      params: { Status: "OK", Authority: "A00000XYZ" },
      order: ORDER,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("تراکنش ناموفق");
  });
});

describe("StripeGateway", () => {
  const usdOrder = { ...ORDER, amount: 4900, currency: "USD", gatewayRefId: "cs_test_1" };

  it("creates a hosted checkout session", async () => {
    const { impl, calls } = stubFetch(200, {
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });

    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });
    const created = await gateway.create({
      orderId: "ord_1",
      orderReference: ORDER.reference,
      amount: 4900,
      currency: "USD",
      description: "AiWp — Regular",
      buyerEmail: "buyer@example.com",
      callbackUrl: "https://shop.example.com/api/payment/callback?order=AW-260907-ABCDE",
    });

    expect(created).toEqual({
      gatewayRefId: "cs_test_1",
      redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(calls[0].init?.headers?.Authorization).toBe(
      `Basic ${Buffer.from("sk_test_1:").toString("base64")}`,
    );

    const body = new URLSearchParams(calls[0].init?.body ?? "");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("4900");
    expect(body.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(body.get("client_reference_id")).toBe(ORDER.reference);
  });

  it("accepts a paid session with a matching amount", async () => {
    const { impl } = stubFetch(200, {
      id: "cs_test_1",
      payment_status: "paid",
      amount_total: 4900,
      currency: "usd",
    });

    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });

    expect(
      await gateway.verify({ params: { session_id: "cs_test_1" }, order: usdOrder }),
    ).toEqual({ ok: true, gatewayRefId: "cs_test_1" });
  });

  it("rejects an unpaid session", async () => {
    const { impl } = stubFetch(200, { id: "cs_test_1", payment_status: "unpaid" });
    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });

    const result = await gateway.verify({ params: { session_id: "cs_test_1" }, order: usdOrder });
    expect(result.ok).toBe(false);
  });

  it("rejects a session whose charged amount differs from the order", async () => {
    const { impl } = stubFetch(200, {
      id: "cs_test_1",
      payment_status: "paid",
      amount_total: 100,
    });
    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });

    const result = await gateway.verify({ params: { session_id: "cs_test_1" }, order: usdOrder });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("مبلغ");
  });

  it("rejects a session id belonging to a different order", async () => {
    const { impl } = stubFetch(200, { id: "cs_other", payment_status: "paid", amount_total: 4900 });
    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });

    const result = await gateway.verify({ params: { session_id: "cs_other" }, order: usdOrder });
    expect(result.ok).toBe(false);
  });

  it("requires a session_id", async () => {
    const { impl } = stubFetch(200, {});
    const gateway = new StripeGateway({ secretKey: "sk_test_1", fetchImpl: impl });

    expect((await gateway.verify({ params: {}, order: usdOrder })).ok).toBe(false);
  });
});

describe("money formatting", () => {
  it("renders Iranian amounts in Rial with the Toman equivalent", () => {
    expect(formatAmount(1_500_000, "IRR")).toContain("ریال");
    expect(formatPriceWithToman(1_500_000, "IRR")).toContain("تومان");
  });

  it("renders subunit currencies as major units", () => {
    expect(formatAmount(4900, "USD")).toBe("$49.00");
  });

  it("does not lose precision on integer money", () => {
    expect(formatAmount(123_456_789, "IRR")).toContain("ریال");
    expect(formatAmount(4900, "USD")).not.toContain("4900");
  });
});

describe("order helpers", () => {
  it("builds readable, unambiguous references", () => {
    const reference = newOrderReference(new Date("2026-09-07T12:00:00Z"));

    const [, , tail] = reference.split("-");
    expect(reference).toMatch(/^AW-260907-[A-Z2-9]{5}$/);
    // The random tail avoids I, O, 0 and 1 — too easy to misread over the
    // phone. (The date segment legitimately contains digits.)
    expect(tail).not.toMatch(/[IO01]/);
  });

  it("produces distinct references", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newOrderReference()));
    expect(seen.size).toBe(200);
  });

  it("builds an absolute callback URL and strips trailing slashes", () => {
    expect(orderCallbackUrl("https://shop.example.com/", "AW-1")).toBe(
      "https://shop.example.com/api/payment/callback?order=AW-1",
    );
  });
});
