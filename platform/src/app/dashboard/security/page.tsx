"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Image from "next/image";
import { useApiQuery, useApiMutation } from "@/lib/use-api-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldOff, Lock } from "lucide-react";

const ME_KEY = ["customer", "me"];

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی الزامی است"),
    newPassword: z
      .string()
      .min(10, "رمز عبور باید حداقل ۱۰ کاراکتر باشد")
      .regex(/[a-z]/, "حرف کوچک لازم است")
      .regex(/[A-Z]/, "حرف بزرگ لازم است")
      .regex(/[0-9]/, "عدد لازم است"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "تکرار رمز عبور مطابقت ندارد",
    path: ["confirmPassword"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

interface MeResponse {
  twoFactorEnabled: boolean;
}

export default function SecurityPage() {
  const { data, isLoading } = useApiQuery<{ user: MeResponse }>(ME_KEY, "/api/customer/me");
  const me = data?.user;

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const changePasswordMutation = useApiMutation<{ message: string }, PasswordValues>(
    "/api/customer/security/change-password",
  );

  const setupMutation = useApiMutation<{ qrCodeDataUrl: string }, Record<string, never>>(
    "/api/auth/2fa/setup",
  );
  const verifyMutation = useApiMutation<{ message: string }, { code: string }>("/api/auth/2fa/verify", {
    invalidateKeys: [ME_KEY],
  });
  const disableMutation = useApiMutation<{ message: string }, Record<string, never>>(
    "/api/customer/security/2fa-disable",
    { invalidateKeys: [ME_KEY] },
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  async function onChangePassword(values: PasswordValues) {
    try {
      const result = await changePasswordMutation.mutateAsync(values);
      toast.success(result.message);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  async function startTwoFactorSetup() {
    try {
      const result = await setupMutation.mutateAsync({});
      setQrCode(result.qrCodeDataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  async function confirmTwoFactor() {
    try {
      const result = await verifyMutation.mutateAsync({ code: totpCode });
      toast.success(result.message);
      setQrCode(null);
      setTotpCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "کد نادرست است.");
    }
  }

  async function disableTwoFactor() {
    try {
      const result = await disableMutation.mutateAsync({});
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <CardTitle>احراز هویت دو مرحله‌ای</CardTitle>
              <CardDescription>یک لایه‌ی امنیتی اضافه با اپلیکیشن‌هایی مثل Google Authenticator</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : me?.twoFactorEnabled ? (
            <div className="flex items-center justify-between">
              <Badge variant="success">فعال</Badge>
              <Button variant="destructive" size="sm" onClick={disableTwoFactor} loading={disableMutation.isPending}>
                <ShieldOff className="size-3.5" /> غیرفعال‌سازی
              </Button>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <Image src={qrCode} alt="کد QR احراز هویت دو مرحله‌ای" width={200} height={200} className="rounded-lg border" />
              <div className="flex w-full flex-col gap-2">
                <Label htmlFor="totp">کد ۶ رقمی اپلیکیشن را وارد کنید</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
              </div>
              <Button onClick={confirmTwoFactor} className="w-full" loading={verifyMutation.isPending}>
                تأیید و فعال‌سازی
              </Button>
            </div>
          ) : (
            <Button onClick={startTwoFactorSetup} loading={setupMutation.isPending}>
              فعال‌سازی احراز هویت دو مرحله‌ای
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Lock className="size-5" />
            </span>
            <div>
              <CardTitle>تغییر رمز عبور</CardTitle>
              <CardDescription>پس از تغییر، از تمام دستگاه‌های دیگر خارج می‌شوید.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onChangePassword)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
              <Input id="currentPassword" type="password" {...register("currentPassword")} />
              {errors.currentPassword && (
                <p className="text-destructive text-xs">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">رمز عبور جدید</Label>
              <Input id="newPassword" type="password" {...register("newPassword")} />
              {errors.newPassword && <p className="text-destructive text-xs">{errors.newPassword.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">تکرار رمز عبور جدید</Label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
              {errors.confirmPassword && (
                <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" loading={changePasswordMutation.isPending} className="self-start">
              تغییر رمز عبور
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
