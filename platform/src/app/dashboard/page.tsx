import { requireSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { licenses } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { StatCard } from "@/components/shell/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const session = await requireSession();

  const [[totalLicenses], [activeLicenses]] = await Promise.all([
    db.select({ value: count() }).from(licenses).where(eq(licenses.userId, session.userId)),
    db
      .select({ value: count() })
      .from(licenses)
      .where(eq(licenses.userId, session.userId)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-gradient-to-l from-primary/10 to-transparent">
        <CardContent className="flex items-center gap-4 py-6">
          <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
            <Sparkles className="size-6" />
          </span>
          <div>
            <p className="font-semibold">خوش آمدید، {session.name} 👋</p>
            <p className="text-muted-foreground text-sm">
              از این‌جا می‌توانید لایسنس‌های خود را مدیریت و امنیت حساب خود را تنظیم کنید.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="کل لایسنس‌ها" value={totalLicenses?.value ?? 0} icon={KeyRound} accent="primary" />
        <StatCard label="لایسنس‌های ثبت‌شده" value={activeLicenses?.value ?? 0} icon={ShieldCheck} accent="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مراحل بعدی</CardTitle>
          <CardDescription>برای امنیت بیشتر، احراز هویت دو مرحله‌ای را فعال کنید.</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <Button asChild variant="outline">
            <Link href="/dashboard/security">رفتن به تنظیمات امنیتی</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
