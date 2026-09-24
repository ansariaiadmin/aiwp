"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { useApiQuery } from "@/lib/use-api-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { formatPriceWithToman } from "@/lib/money";

interface CustomerOrder {
  id: string;
  reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
  amount: number;
  currency: string;
  gateway: string;
  productName: string;
  planName: string;
  paidAt: string | null;
  createdAt: string;
  licenseKey: string | null;
  licenseId: string | null;
  productSlug: string | null;
}

const STATUS_LABEL: Record<CustomerOrder["status"], string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  CANCELED: "لغو شده",
  REFUNDED: "بازگشت داده شده",
};

const STATUS_VARIANT: Record<
  CustomerOrder["status"],
  "success" | "secondary" | "destructive" | "warning"
> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "destructive",
  CANCELED: "secondary",
  REFUNDED: "secondary",
};

export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CustomerOrders />
    </Suspense>
  );
}

function CustomerOrders() {
  const searchParams = useSearchParams();
  const { data, isLoading } = useApiQuery<{ orders: CustomerOrder[] }>(
    ["customer", "orders"],
    "/api/store/orders",
  );
  const orders = data?.orders ?? [];

  // The payment callback redirects back here with the outcome, so the buyer
  // gets an unambiguous confirmation instead of having to infer it.
  useEffect(() => {
    const paid = searchParams.get("paid");
    const failed = searchParams.get("failed");
    const reason = searchParams.get("reason");

    if (paid) toast.success(`پرداخت سفارش ${paid} با موفقیت انجام شد.`);
    if (failed) toast.error(reason ? `${failed}: ${reason}` : `پرداخت سفارش ${failed} ناموفق بود.`);
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">سفارش‌های من</h1>
          <p className="text-muted-foreground text-sm">
            تاریخچه‌ی خریدها و کلیدهای لایسنس صادرشده.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/store">فروشگاه</Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            هنوز سفارشی ثبت نکرده‌اید.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>
                    {order.productName} — {order.planName}
                  </span>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {STATUS_LABEL[order.status]}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  شماره سفارش {order.reference} · {formatDate(order.createdAt)} · درگاه{" "}
                  {order.gateway}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatPriceWithToman(order.amount, order.currency)}
                  </span>
                  {order.paidAt ? (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <CheckCircle2 className="size-3.5" />
                      پرداخت در {formatDate(order.paidAt)}
                    </span>
                  ) : null}
                </div>

                {order.licenseKey ? (
                  <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
                    <span className="flex items-center gap-2 text-sm">
                      <KeyRound className="text-primary size-4" />
                      <code className="font-mono text-xs">{order.licenseKey}</code>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/licenses">مدیریت لایسنس‌ها</Link>
                    </Button>
                  </div>
                ) : order.status === "FAILED" ? (
                  <p className="text-destructive flex items-center gap-2 text-xs">
                    <XCircle className="size-3.5" />
                    پرداخت این سفارش کامل نشد؛ می‌توانید دوباره از فروشگاه اقدام کنید.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
