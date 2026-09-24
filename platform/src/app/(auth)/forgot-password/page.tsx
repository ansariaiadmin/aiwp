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
import { MailCheck } from "lucide-react";

const schema = z.object({ email: z.string().email("ایمیل معتبر نیست") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? "خطایی رخ داد.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <MailCheck className="text-primary size-12" />
          <p className="text-sm">اگر ایمیل شما در سامانه ثبت شده باشد، لینک بازیابی رمز عبور برایتان ارسال شد.</p>
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
        <CardTitle className="text-xl">بازیابی رمز عبور</CardTitle>
        <CardDescription>ایمیل حساب خود را وارد کنید تا لینک بازیابی برایتان ارسال شود.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" dir="ltr" {...register("email")} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <Button type="submit" loading={submitting}>
            ارسال لینک بازیابی
          </Button>
        </form>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            بازگشت به صفحه ورود
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
