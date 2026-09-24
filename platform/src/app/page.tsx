import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Zap, LayoutDashboard } from "lucide-react";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(session.role === "CUSTOMER" ? "/dashboard" : "/admin");
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,var(--accent)_0%,transparent_45%),radial-gradient(circle_at_80%_0%,var(--accent)_0%,transparent_40%)] opacity-60"
      />

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          AiWp Platform
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">ورود</Link>
          </Button>
          <Button asChild>
            <Link href="/register">ثبت‌نام</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center sm:px-10">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-medium">
            مدیریت یکپارچه‌ی فکتوری پلاگین وردپرس
          </span>
          <h1 className="max-w-2xl text-4xl font-bold text-balance sm:text-5xl">
            بک‌اند تمیز، امن و حرفه‌ای برای مدیریت لایسنس‌ها و مشتریان
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-balance">
            پنل ادمین برای مدیریت کامل محصولات، لایسنس‌ها، تنظیمات هوش مصنوعی و پیامک، و داشبورد
            اختصاصی برای مشتریان — همه در یک پلتفرم امن و سریع.
          </p>
          <div className="mt-2 flex gap-3">
            <Button asChild size="lg">
              <Link href="/register">شروع کنید</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">ورود به پنل</Link>
            </Button>
          </div>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<ShieldCheck className="size-6" />}
            title="امنیت درجه‌یک"
            description="رمزنگاری AES-256، Argon2id، 2FA و ثبت کامل رویدادها"
          />
          <FeatureCard
            icon={<Zap className="size-6" />}
            title="کارایی بالا"
            description="React Server Components، کش هوشمند و معماری بدون واسط اضافه"
          />
          <FeatureCard
            icon={<LayoutDashboard className="size-6" />}
            title="پنل‌های جدا"
            description="پنل مدیریت کامل و داشبورد اختصاصی مشتری، هرکدام مستقل"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card flex flex-col items-center gap-2 rounded-xl border p-6 text-center shadow-sm">
      <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
