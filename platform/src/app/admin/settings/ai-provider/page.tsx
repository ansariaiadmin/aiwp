"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Bot, KeyRound } from "lucide-react";

const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter (هر مدلی)" },
  { id: "custom", label: "سفارشی (Custom OpenAI-compatible)" },
] as const;

const schema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  model: z.string().min(1, "نام مدل الزامی است"),
  baseUrl: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface ConfigResponse {
  provider: string;
  apiKey: string | null;
  apiKeySet: boolean;
  model: string;
  baseUrl: string | null;
}

const CONFIG_KEY = ["admin", "settings", "ai-provider"];

export default function AiProviderSettingsPage() {
  const { data, isLoading } = useApiQuery<{ config: ConfigResponse }>(
    CONFIG_KEY,
    "/api/admin/settings/ai-provider",
  );
  const config = data?.config;

  const [apiKeySetOverride, setApiKeySetOverride] = useState<boolean | null>(null);
  const apiKeySet = apiKeySetOverride ?? config?.apiKeySet ?? false;

  const saveMutation = useApiMutation<{ message: string }, FormValues>("/api/admin/settings/ai-provider", {
    method: "PUT",
    invalidateKeys: [CONFIG_KEY],
  });

  const { register, handleSubmit, control } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: config
      ? { provider: config.provider, model: config.model, baseUrl: config.baseUrl ?? "", apiKey: "" }
      : undefined,
    defaultValues: { provider: "openai", model: "", apiKey: "", baseUrl: "" },
  });

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
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Bot className="size-5" />
            </span>
            <div>
              <CardTitle>تنظیمات فراهم‌کننده هوش مصنوعی</CardTitle>
              <CardDescription>ایجنت را به هر مدلی که می‌خواهید وصل کنید.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>فراهم‌کننده</Label>
              <Controller
                control={control}
                name="provider"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model">نام مدل</Label>
              <Input id="model" dir="ltr" placeholder="gpt-4.1" {...register("model")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="baseUrl">آدرس پایه (اختیاری — برای سرویس سفارشی)</Label>
              <Input
                id="baseUrl"
                dir="ltr"
                placeholder="https://api.example.com/v1"
                {...register("baseUrl")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <KeyRound className="size-3.5" />
                کلید API
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
                placeholder={config?.apiKey ?? "کلید API را وارد کنید"}
                autoComplete="off"
                {...register("apiKey")}
              />
              <p className="text-muted-foreground text-xs">
                برای حفظ کلید فعلی، این فیلد را خالی بگذارید. کلیدها رمزنگاری‌شده (AES-256-GCM) ذخیره
                می‌شوند.
              </p>
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
