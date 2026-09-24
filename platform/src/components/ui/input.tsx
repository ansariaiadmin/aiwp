import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-transparent flex h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-sm shadow-sm transition-colors outline-none placeholder:text-muted-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
