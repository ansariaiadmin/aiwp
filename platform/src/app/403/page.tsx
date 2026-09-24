import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldAlert className="text-destructive size-16" />
      <h1 className="text-2xl font-bold">دسترسی غیرمجاز</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        شما اجازه‌ی دسترسی به این بخش را ندارید. اگر فکر می‌کنید این یک اشتباه است، با مدیر سامانه تماس بگیرید.
      </p>
      <Button asChild>
        <Link href="/">بازگشت به صفحه اصلی</Link>
      </Button>
    </div>
  );
}
