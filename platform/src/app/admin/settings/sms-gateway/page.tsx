"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/lib/use-api-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareText, KeyRound } from "lucide-react";

const SMS_DRIVERS = [
  { id: "kavenegar", label: "Kavenegar" },
  { id: "melipayamak", label: "MeliPayamak" },
] as const;

const schema = z.object({
  driver: z.string().min(1),
  apiKey: z.string().optional(),
  sender: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface ConfigResponse {
  driver: string;
  apiKey: string | null;
  apiKeySet: boolean;
  sender: string | null;
}

const CONFIG_KEY = ["admin", "settings", "sms-gateway"];

export default function SmsGatewaySettingsPage() {
  const { data, isLoading } = useApiQuery<{ config: ConfigResponse }>(
    CONFIG_KEY,
    "/api/admin/settings/sms-gateway",
  );
  const config = data?.config;
  const [apiKeySetOverride, setApiKeySetOverride] = useState<boolean | null>(null);
  const apiKeySet = apiKeySetOverride ?? config?.apiKeySet ?? false;

  const saveMutation = useApiMutation<{ message: string }, FormValues>("/api/admin/settings/sms-gateway", {
    method: "PUT",
    invalidateKeys: [CONFIG_KEY],
  });

  const { register, handleSubmit, control } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: config ? { driver: config.driver, sender: config.sender ?? "", apiKey: "" } : undefined,
    defaultValues: { driver: "kavenegar", apiKey: "", sender: "" },
  });

  const driver = useWatch({ control, name: "driver" });

  async function onSubmit(values: FormValues) {
    try {
      const result = await saveMutation.mutateAsync(values);
      toast.success(result.message);
      if (values.apiKey) setApiKeySetOverride(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-2xl" />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <MessageSquareText className="size-5" />
            </span>
            <div>
              <CardTitle>تنظیمات پنل پیامک</CardTitle>
              <CardDescription>
                همان دو درایور موجود در ماژول sms-gateway فکتوری وردپرس.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>سرویس پیامکی</Label>
              <Controller
                control={control}
                name="driver"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SMS_DRIVERS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sender">
                {driver === "melipayamak" ? "رمز عبور پنل / شماره خط ارسال" : "شماره خط ارسال‌کننده"}
              </Label>
              <Input id="sender" dir="ltr" {...register("sender")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <KeyRound className="size-3.5" />
                {driver === "melipayamak" ? "نام کاربری پنل" : "کلید API"}
                {apiKeySet && (
                  <Badge variant="success" className="me-auto">
                    تنظیم شده
                  </Badge>
                )}
              </Label>
              <Input
                id="apiKey"
                type="password"
                dir="ltr"
                placeholder={config?.apiKey ?? "کلید/نام کاربری را وارد کنید"}
                autoComplete="off"
                {...register("apiKey")}
              />
            </div>

            <Button type="submit" loading={saveMutation.isPending} className="mt-2 self-start">
              ذخیره تنظیمات
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
