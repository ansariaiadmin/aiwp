"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/lib/use-api-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyRound, Plus, MoreVertical, Copy } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface License {
  id: string;
  key: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "EXPIRED";
  maxActivations: number;
  expiresAt: string | null;
  createdAt: string;
  productName: string;
  productSlug: string;
  userEmail: string;
  userName: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

const LICENSES_KEY = ["admin", "licenses"];

const createSchema = z.object({
  productId: z.string().min(1, "محصول را انتخاب کنید"),
  userEmail: z.string().email("ایمیل معتبر نیست"),
  maxActivations: z.number().int().min(1).max(1000),
});
type CreateValues = z.infer<typeof createSchema>;

const STATUS_LABEL: Record<License["status"], string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  SUSPENDED: "مسدود",
  EXPIRED: "منقضی",
};

const STATUS_VARIANT: Record<License["status"], "success" | "secondary" | "destructive" | "warning"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
  EXPIRED: "warning",
};

export default function LicensesPage() {
  const { data: licensesData, isLoading } = useApiQuery<{ licenses: License[] }>(
    LICENSES_KEY,
    "/api/admin/licenses",
  );
  const { data: productsData } = useApiQuery<{ products: Product[] }>(
    ["admin", "products"],
    "/api/admin/products",
  );

  const licenses = licensesData?.licenses ?? [];
  const products = productsData?.products ?? [];
  const [createOpen, setCreateOpen] = useState(false);

  const createMutation = useApiMutation<{ license: License }, CreateValues>("/api/admin/licenses", {
    invalidateKeys: [LICENSES_KEY],
  });

  const statusMutation = useApiMutation<{ license: License }, { id: string; status: License["status"] }>(
    (body) => `/api/admin/licenses/${body.id}`,
    { method: "PATCH", invalidateKeys: [LICENSES_KEY] },
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { maxActivations: 1, productId: "", userEmail: "" },
  });

  async function onCreate(values: CreateValues) {
    try {
      const result = await createMutation.mutateAsync(values);
      toast.success(`لایسنس صادر شد: ${result.license.key}`);
      setCreateOpen(false);
      reset({ maxActivations: 1, productId: "", userEmail: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  async function updateStatus(id: string, status: License["status"]) {
    try {
      await statusMutation.mutateAsync({ id, status });
      toast.success("وضعیت لایسنس به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("کلید لایسنس کپی شد.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">لایسنس‌ها</h2>
          <p className="text-muted-foreground text-sm">صدور، ابطال و مشاهده‌ی وضعیت لایسنس‌ها</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> صدور لایسنس
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>صدور لایسنس جدید</DialogTitle>
              <DialogDescription>کاربر باید از قبل در سامانه ثبت‌نام کرده باشد.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>محصول</Label>
                <Controller
                  control={control}
                  name="productId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب محصول" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.productId && <p className="text-destructive text-xs">{errors.productId.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="userEmail">ایمیل مشتری</Label>
                <Input id="userEmail" dir="ltr" {...register("userEmail")} />
                {errors.userEmail && <p className="text-destructive text-xs">{errors.userEmail.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxActivations">حداکثر تعداد فعال‌سازی</Label>
                <Input
                  id="maxActivations"
                  type="number"
                  dir="ltr"
                  {...register("maxActivations", { valueAsNumber: true })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" loading={createMutation.isPending}>
                  صدور لایسنس
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
              <KeyRound className="size-8" />
              هنوز لایسنسی صادر نشده است.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کلید</TableHead>
                  <TableHead>محصول</TableHead>
                  <TableHead>مشتری</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>سقف فعال‌سازی</TableHead>
                  <TableHead>تاریخ صدور</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell dir="ltr" className="font-mono text-xs">
                      <button
                        onClick={() => copyKey(license.key)}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        {license.key} <Copy className="size-3" />
                      </button>
                    </TableCell>
                    <TableCell>{license.productName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{license.userName}</span>
                        <span className="text-muted-foreground text-xs" dir="ltr">
                          {license.userEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[license.status]}>{STATUS_LABEL[license.status]}</Badge>
                    </TableCell>
                    <TableCell dir="ltr">{license.maxActivations}</TableCell>
                    <TableCell>{formatDate(license.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => updateStatus(license.id, "ACTIVE")}>
                            فعال‌سازی
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(license.id, "SUSPENDED")}>
                            مسدودسازی
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => updateStatus(license.id, "INACTIVE")}
                          >
                            ابطال
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
