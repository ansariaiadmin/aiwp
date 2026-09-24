import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared header for the public storefront (no auth required). */
export function StoreHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/store" className="flex items-center gap-2 font-bold">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <Sparkles className="size-5" />
          </span>
          AiWp Platform
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/store">فروشگاه</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">ورود</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">ثبت‌نام</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
