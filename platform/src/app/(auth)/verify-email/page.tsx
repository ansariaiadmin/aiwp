"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

async function verifyEmail(token: string) {
  const res = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? "خطا در تأیید ایمیل.");
  }

  return data as { message: string };
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { data, error, isLoading } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => verifyEmail(token!),
    enabled: Boolean(token),
    retry: false,
  });

  const state = !token ? "error" : isLoading ? "loading" : error ? "error" : "success";
  const message = !token
    ? "توکن تأیید یافت نشد."
    : error instanceof Error
      ? error.message
      : (data?.message ?? "");

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        {state === "loading" && <Loader2 className="text-primary size-12 animate-spin" />}
        {state === "success" && <CheckCircle2 className="text-success size-12" />}
        {state === "error" && <XCircle className="text-destructive size-12" />}
        <p className="text-sm">{state === "loading" ? "در حال بررسی..." : message}</p>
        {state !== "loading" && (
          <Button asChild variant="outline">
            <Link href="/login">بازگشت به صفحه ورود</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
