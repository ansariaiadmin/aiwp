"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/lib/use-api-query";
import { formatNumber } from "@/lib/utils";

interface SignupPoint {
  day: string;
  count: number;
}

/**
 * Renders the last-14-days signup trend backed by lib/stats.ts's
 * getSignupSeries(). Client-side (recharts needs the DOM), fetched via
 * React Query so it caches/dedupes like every other admin data view.
 */
export function SignupChart() {
  const { data, isLoading } = useApiQuery<{ series: SignupPoint[] }>(
    ["admin", "stats", "signups"],
    "/api/admin/stats/signups",
  );

  if (isLoading) {
    return <Skeleton className="h-[280px] w-full" />;
  }

  const series = (data?.series ?? []).map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("fa-IR", { day: "2-digit", month: "2-digit" }).format(
      new Date(point.day),
    ),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>روند ثبت‌نام کاربران</CardTitle>
        <CardDescription>۱۴ روز گذشته</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {series.every((point) => point.count === 0) ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            هنوز داده‌ای برای نمایش وجود ندارد.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value) => [formatNumber(Number(value ?? 0)), "ثبت‌نام"]}
                labelFormatter={(label) => label}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#signupFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
