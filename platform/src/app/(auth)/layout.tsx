import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,var(--accent)_0%,transparent_45%),radial-gradient(circle_at_80%_0%,var(--accent)_0%,transparent_40%)] opacity-60"
      />
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            AiWp Platform
          </Link>
          <p className="text-muted-foreground text-sm">مدیریت یکپارچه‌ی فکتوری پلاگین وردپرس</p>
        </div>
        {children}
      </div>
    </div>
  );
}
