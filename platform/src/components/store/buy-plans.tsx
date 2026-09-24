"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { formatPriceWithToman } from "@/lib/money";

export interface StorePlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  maxActivations: number;
  durationDays: number | null;
  supportDays: number;
  isFeatured: boolean;
}

/**
 * Plan picker + checkout trigger. Choosing a plan POSTs to
 * /api/store/checkout, which creates the order and returns the gateway's
 * redirect URL; this component then hands the browser over to the gateway.
 * Unauthenticated visitors are sent to /login with a return path.
 */
export function BuyPlans({ plans }: { plans: StorePlan[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(
    plans.find((plan) => plan.isFeatured)?.id ?? plans[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          هنوز پلن فروش فعالی برای این محصول تعریف نشده است.
        </CardContent>
      </Card>
    );
  }

  async function buy() {
    setBusy(true);

    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          toast.error("برای خرید ابتدا وارد حساب خود شوید.");
          router.push("/login");
          return;
        }

        toast.error(data.message ?? "ثبت سفارش ناموفق بود.");
        return;
      }

      toast.success(`سفارش ${data.reference} ثبت شد. در حال انتقال به درگاه پرداخت…`);
      window.location.href = data.redirectUrl;
    } catch {
      toast.error("اتصال به سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(plan.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setSelected(plan.id);
            }}
            className={cn(
              "cursor-pointer transition-colors",
              selected === plan.id && "border-primary ring-primary/20 ring-2",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {plan.name}
                {plan.isFeatured ? <Badge variant="success">پیشنهادی</Badge> : null}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-primary text-2xl font-bold">
                {formatPriceWithToman(plan.price, plan.currency)}
              </p>
              <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="size-4" />
                  {plan.maxActivations === 1
                    ? "فعال‌سازی روی یک سایت"
                    : `فعال‌سازی روی ${formatNumber(plan.maxActivations)} سایت`}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4" />
                  {plan.durationDays ? `اعتبار ${formatNumber(plan.durationDays)} روزه` : "اعتبار مادام‌العمر"}
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  {plan.supportDays > 0
                    ? `${formatNumber(plan.supportDays)} روز پشتیبانی و به‌روزرسانی`
                    : "بدون پشتیبانی"}
                </li>
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="lg" onClick={buy} disabled={busy || !selected}>
        <ShoppingCart className="size-4" />
        {busy ? "در حال انتقال به درگاه…" : "خرید و پرداخت"}
      </Button>
    </div>
  );
}
