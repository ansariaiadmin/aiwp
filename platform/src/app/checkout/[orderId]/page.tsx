"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CreditCard, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreHeader } from "@/components/store/store-header";
import { formatPriceWithToman } from "@/lib/money";

interface CheckoutOrder {
  id: string;
  reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
  amount: number;
  currency: string;
  productName: string;
  planName: string;
  gateway: "mock" | "zarinpal" | "stripe";
  mockAuthority: string | null;
}

/**
 * The simulated gateway page.
 *
 * Only the keyless "mock" gateway ever sends a buyer here (see
 * MockGateway.create()); a real gateway hosts its own page. It therefore
 * renders an honest "this is a test gateway" notice and two links that
 * reproduce exactly what a provider does at the end of a transaction:
 * send the buyer back to /api/payment/callback with a status and an
 * authority. The server still verifies everything, so even here nothing is
 * granted without the authority matching the order.
 */
export default function CheckoutGatewayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/store/checkout/${orderId}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.message ?? "سفارش یافت نشد.");
          return;
        }

        setOrder(data.order as CheckoutOrder);
      })
      .catch(() => {
        if (!cancelled) setError("اتصال به سرور برقرار نشد.");
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const callback = (status: "ok" | "cancel") =>
    `/api/payment/callback?order=${encodeURIComponent(order?.reference ?? "")}&status=${status}&authority=${encodeURIComponent(order?.mockAuthority ?? "")}`;

  return (
    <div className="bg-background min-h-svh">
      <StoreHeader />
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="text-primary size-5" />
              درگاه پرداخت آزمایشی
            </CardTitle>
            <CardDescription>
              این صفحه فقط برای توسعه و دموی محصول است و هیچ پولی جابه‌جا نمی‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? (
              <p className="text-destructive flex items-center gap-2 text-sm">
                <ShieldAlert className="size-4" />
                {error}
              </p>
            ) : null}

            {!order && !error ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : null}

            {order ? (
              <>
                <dl className="bg-muted/40 flex flex-col gap-2 rounded-xl p-4 text-sm">
                  <Row label="شماره سفارش" value={order.reference} />
                  <Row label="محصول" value={order.productName} />
                  <Row label="پلن" value={order.planName} />
                  <Row label="مبلغ" value={formatPriceWithToman(order.amount, order.currency)} />
                  <Row label="وضعیت" value={order.status} />
                </dl>

                {order.gateway !== "mock" ? (
                  <p className="text-muted-foreground text-sm">
                    این سفارش با درگاه {order.gateway} ثبت شده است؛ پرداخت باید در صفحه‌ی خود
                    درگاه انجام شود.
                  </p>
                ) : order.status !== "PENDING" ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <XCircle className="size-4" />
                    این سفارش قبلاً تعیین تکلیف شده است ({order.status}).
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button asChild size="lg">
                      <a href={callback("ok")}>پرداخت موفق (شبیه‌سازی)</a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href={callback("cancel")}>لغو پرداخت</a>
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
