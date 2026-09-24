import { getAdminDashboardStats, getRecentAuditLogs } from "@/lib/stats";
import { StatCard } from "@/components/shell/stat-card";
import { SignupChart } from "@/components/shell/signup-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, KeyRound, Package, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-labels";
import type { AuditAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, recentLogs] = await Promise.all([
    getAdminDashboardStats(),
    getRecentAuditLogs(8),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل کاربران" value={stats.totalUsers} icon={Users} accent="primary" />
        <StatCard label="مشتریان" value={stats.totalCustomers} icon={UserPlus} accent="success" />
        <StatCard label="لایسنس‌های فعال" value={stats.activeLicenses} icon={KeyRound} accent="warning" />
        <StatCard label="محصولات" value={stats.totalProducts} icon={Package} accent="primary" />
      </div>

      <SignupChart />

      <Card>
        <CardHeader>
          <CardTitle>آخرین رویدادها</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">هنوز رویدادی ثبت نشده است.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {AUDIT_ACTION_LABELS[log.action as AuditAction] ?? log.action}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {log.actor?.email ?? "سیستم"} · {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <Badge variant="outline">{log.ip ?? "—"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
