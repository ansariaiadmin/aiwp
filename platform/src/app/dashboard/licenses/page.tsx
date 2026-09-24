"use client";

import { toast } from "sonner";
import { useApiQuery } from "@/lib/use-api-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KeyRound, Copy, Download, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface LicenseActivation {
  siteUrl: string;
  activatedAt: string;
}

interface CustomerLicense {
  id: string;
  key: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "EXPIRED";
  maxActivations: number;
  expiresAt: string | null;
  createdAt: string;
  productName: string;
  productSlug: string;
  productVersion: string;
  packageUrl: string | null;
  activations: LicenseActivation[];
}

const STATUS_LABEL: Record<CustomerLicense["status"], string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  SUSPENDED: "مسدود",
  EXPIRED: "منقضی",
};

const STATUS_VARIANT: Record<CustomerLicense["status"], "success" | "secondary" | "destructive" | "warning"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
  EXPIRED: "warning",
};

export default function CustomerLicensesPage() {
  const { data, isLoading } = useApiQuery<{ licenses: CustomerLicense[] }>(
    ["customer", "licenses"],
    "/api/customer/licenses",
  );
  const licenses = data?.licenses ?? [];

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("کلید لایسنس کپی شد.");
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (licenses.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
          <KeyRound className="size-8" />
          هنوز لایسنسی برای شما صادر نشده است.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {licenses.map((license) => (
        <Card key={license.id}>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{license.productName}</p>
                <p className="text-muted-foreground text-xs" dir="ltr">
                  نسخه فعلی: {license.productVersion}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[license.status]}>{STATUS_LABEL[license.status]}</Badge>
            </div>

            <button
              onClick={() => copyKey(license.key)}
              className="bg-muted hover:bg-accent flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-mono text-xs transition-colors"
              dir="ltr"
            >
              {license.key}
              <Copy className="size-3.5 shrink-0" />
            </button>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                فعال‌سازی‌ها: {license.activations.length} / {license.maxActivations}
              </span>
              <span className="text-muted-foreground">صادر شده: {formatDate(license.createdAt)}</span>
            </div>

            {license.activations.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-3">
                {license.activations.map((activation) => (
                  <div key={activation.siteUrl} className="flex items-center gap-2 text-xs">
                    <Globe className="text-muted-foreground size-3.5" />
                    <span dir="ltr" className="truncate">
                      {activation.siteUrl}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {license.packageUrl && (
              <Button asChild size="sm" variant="outline" className="mt-1 self-start">
                <a href={license.packageUrl} target="_blank" rel="noreferrer">
                  <Download className="size-3.5" /> دانلود آخرین نسخه
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
