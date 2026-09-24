"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

const schema = z
  .object({
    name: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
    email: z.string().email("ایمیل معتبر نیست"),
    password: z
      .string()
      .min(10, "رمز عبور باید حداقل ۱۰ کاراکتر باشد")
      .regex(/[a-z]/, "حرف کوچک لازم است")
      .regex(/[A-Z]/, "حرف بزرگ لازم است")
      .regex(/[0-9]/, "عدد لازم است"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "تکرار رمز عبور مطابقت ندارد",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? "ثبت‌نام ناموفق بود.");
        return;
      }

      setDone(true);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="text-success size-12" />
          <div>
            <p className="font-medium">ثبت‌نام با موفقیت انجام شد</p>
            <p className="text-muted-foreground mt-1 text-sm">
              لطفاً ایمیل خود را بررسی کرده و روی لینک تأیید کلیک کنید.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/login">بازگشت به صفحه ورود</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">ایجاد حساب کاربری</CardTitle>
        <CardDescription>برای استفاده از داشبورد مشتری ثبت‌نام کنید.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">نام و نام خانوادگی</Label>
            <Input id="name" autoComplete="name" {...register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" dir="ltr" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">تکرار رمز عبور</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" loading={submitting} className="mt-2">
            ثبت‌نام
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link href="/login" className="text-primary hover:underline">
            وارد شوید
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
