"use client";

import { useApiQuery } from "@/lib/use-api-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { formatPriceWithToman } from "@/lib/money";

interface AdminOrder {
  id: string;
  reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
  amount: number;
  currency: string;
  gateway: string;
  gatewayRefId: string | null;
  productName: string;
  planName: string;
  paidAt: string | null;
  createdAt: string;
  userEmail: string;
  userName: string;
}

const STATUS_VARIANT: Record<
  AdminOrder["status"],
  "success" | "secondary" | "destructive" | "warning"
> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "destructive",
  CANCELED: "secondary",
  REFUNDED: "secondary",
};

const STATUS_LABEL: Record<AdminOrder["status"], string> = {
  PENDING: "در انتظار",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  CANCELED: "لغو شده",
  REFUNDED: "بازگشتی",
};

export default function AdminOrdersPage() {
  const { data, isLoading } = useApiQuery<{ orders: AdminOrder[] }>(
    ["admin", "orders"],
    "/api/admin/orders",
  );
  const orders = data?.orders ?? [];

  const paid = orders.filter((order) => order.status === "PAID");
  const revenue = paid.reduce((sum, order) => sum + order.amount, 0);
  const currency = paid[0]?.currency ?? "IRR";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">سفارش‌ها</h1>
        <p className="text-muted-foreground text-sm">
          {paid.length} پرداخت موفق از {orders.length} سفارش · مجموع{" "}
          {formatPriceWithToman(revenue, currency)}
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            هنوز سفارشی ثبت نشده است.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شماره</TableHead>
                  <TableHead>مشتری</TableHead>
                  <TableHead>محصول / پلن</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>درگاه</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{order.userName}</span>
                        <span className="text-muted-foreground text-xs">{order.userEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.productName} — {order.planName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatPriceWithToman(order.amount, order.currency)}
                    </TableCell>
                    <TableCell className="text-xs">{order.gateway}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status]}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
