import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <FileQuestion className="text-muted-foreground size-16" />
      <h1 className="text-2xl font-bold">صفحه پیدا نشد</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        صفحه‌ای که به دنبال آن بودید وجود ندارد یا جابه‌جا شده است.
      </p>
      <Button asChild>
        <Link href="/">بازگشت به صفحه اصلی</Link>
      </Button>
    </div>
  );
}
