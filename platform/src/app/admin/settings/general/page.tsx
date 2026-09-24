"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings2, ShieldCheck, Database, Server } from "lucide-react";

export default function GeneralSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Settings2 className="size-5" />
            </span>
            <div>
              <CardTitle>وضعیت سامانه</CardTitle>
              <CardDescription>اطلاعات کلی زیرساخت پلتفرم</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <InfoRow icon={<Database className="size-4" />} label="پایگاه داده" value="PostgreSQL" />
          <InfoRow icon={<Server className="size-4" />} label="محیط اجرا" value={process.env.NODE_ENV ?? "production"} />
          <InfoRow
            icon={<ShieldCheck className="size-4" />}
            label="رمزنگاری تنظیمات حساس"
            value={<Badge variant="success">AES-256-GCM فعال</Badge>}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
