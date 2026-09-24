"use client";

import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/lib/use-api-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, MoreVertical, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const USERS_KEY = ["admin", "users"];

const ROLE_LABEL: Record<AdminUser["role"], string> = {
  SUPER_ADMIN: "ابرمدیر",
  ADMIN: "مدیر",
  CUSTOMER: "مشتری",
};

const STATUS_LABEL: Record<AdminUser["status"], string> = {
  ACTIVE: "فعال",
  SUSPENDED: "مسدود",
  PENDING_VERIFICATION: "در انتظار تأیید",
};

export default function UsersPage() {
  const { data, isLoading } = useApiQuery<{ users: AdminUser[] }>(USERS_KEY, "/api/admin/users");
  const users = data?.users ?? [];

  const updateMutation = useApiMutation<{ user: AdminUser }, { id: string; body: Record<string, unknown> }>(
    (payload) => `/api/admin/users/${payload.id}`,
    { method: "PATCH", invalidateKeys: [USERS_KEY] },
  );

  async function updateUser(id: string, body: Record<string, unknown>) {
    try {
      await updateMutation.mutateAsync({ id, body });
      toast.success("کاربر به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">کاربران</h2>
        <p className="text-muted-foreground text-sm">مدیریت نقش و وضعیت کاربران سامانه</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
              <Users className="size-8" />
              کاربری یافت نشد.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>ایمیل</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>۲FA</TableHead>
                  <TableHead>آخرین ورود</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "CUSTOMER" ? "secondary" : "default"}>
                        {ROLE_LABEL[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "ACTIVE" ? "success" : "warning"}>
                        {STATUS_LABEL[user.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.twoFactorEnabled ? (
                        <ShieldCheck className="text-success size-4" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>نقش</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => updateUser(user.id, { role: "ADMIN" })}>
                            تبدیل به مدیر
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateUser(user.id, { role: "CUSTOMER" })}>
                            تبدیل به مشتری
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>وضعیت</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => updateUser(user.id, { status: "ACTIVE" })}>
                            فعال‌سازی
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => updateUser(user.id, { status: "SUSPENDED" })}
                          >
                            مسدودسازی
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
