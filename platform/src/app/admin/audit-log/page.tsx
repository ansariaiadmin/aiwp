"use client";

import { useApiQuery } from "@/lib/use-api-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-labels";
import type { AuditAction } from "@/lib/audit";

interface AuditLogRow {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

export default function AuditLogPage() {
  const { data, isLoading } = useApiQuery<{ logs: AuditLogRow[] }>(
    ["admin", "audit-log"],
    "/api/admin/audit-log",
  );
  const logs = data?.logs ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">گزارش رویدادها</h2>
        <p className="text-muted-foreground text-sm">ثبت تمام رویدادهای حساس سامانه (فقط‌خواندنی)</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
              <ScrollText className="size-8" />
              هنوز رویدادی ثبت نشده است.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رویداد</TableHead>
                  <TableHead>انجام‌دهنده</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>زمان</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {AUDIT_ACTION_LABELS[log.action as AuditAction] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground text-xs">
                      {log.actor?.email ?? "سیستم"}
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground text-xs">
                      {log.ip ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
