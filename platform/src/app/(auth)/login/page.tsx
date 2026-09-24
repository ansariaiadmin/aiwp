"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(1, "رمز عبور الزامی است"),
  totpCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? "ورود ناموفق بود.");
        return;
      }

      if (data.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        toast.info("کد تأیید دو مرحله‌ای را وارد کنید.");
        return;
      }

      toast.success("ورود موفقیت‌آمیز بود.");
      const next = searchParams.get("next");
      const destination = next ?? (data.user?.role === "CUSTOMER" ? "/dashboard" : "/admin");
      router.push(destination);
      router.refresh();
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">ورود به حساب کاربری</CardTitle>
        <CardDescription>برای دسترسی به پنل، اطلاعات حساب خود را وارد کنید.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" autoComplete="email" dir="ltr" {...register("email")} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">رمز عبور</Label>
              <Link href="/forgot-password" className="text-primary text-xs hover:underline">
                فراموشی رمز عبور؟
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          </div>

          {needsTwoFactor && (
            <div className="flex flex-col gap-2 animate-fade-in">
              <Label htmlFor="totpCode">کد تأیید دو مرحله‌ای</Label>
              <Input
                id="totpCode"
                inputMode="numeric"
                dir="ltr"
                maxLength={6}
                placeholder="123456"
                {...register("totpCode")}
              />
            </div>
          )}

          <Button type="submit" loading={submitting} className="mt-2">
            ورود
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="text-primary hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
