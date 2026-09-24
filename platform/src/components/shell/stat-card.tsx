import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "primary",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-5">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
          {trend && <p className="text-muted-foreground mt-1 text-xs">{trend}</p>}
        </div>
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accent === "primary" && "bg-primary/10 text-primary",
            accent === "success" && "bg-success/10 text-success",
            accent === "warning" && "bg-warning/10 text-warning-foreground",
            accent === "destructive" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
