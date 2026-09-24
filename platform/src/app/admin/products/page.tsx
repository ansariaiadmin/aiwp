"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Package, Plus, Rocket } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currentVersion: string;
  isActive: boolean;
  createdAt: string;
}

const PRODUCTS_KEY = ["admin", "products"];

const createSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  currentVersion: z.string().min(1),
});
type CreateValues = z.infer<typeof createSchema>;

const releaseSchema = z.object({
  version: z.string().min(1),
  changelog: z.string().optional(),
  packageUrl: z.string().url("آدرس بسته را وارد کنید"),
});
type ReleaseValues = z.infer<typeof releaseSchema>;

export default function ProductsPage() {
  const { data, isLoading } = useApiQuery<{ products: Product[] }>(PRODUCTS_KEY, "/api/admin/products");
  const products = data?.products ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<Product | null>(null);

  const createMutation = useApiMutation<{ product: Product }, CreateValues>("/api/admin/products", {
    invalidateKeys: [PRODUCTS_KEY],
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { currentVersion: "1.0.0" },
  });

  async function onCreate(values: CreateValues) {
    try {
      await createMutation.mutateAsync(values);
      toast.success("محصول ایجاد شد.");
      setCreateOpen(false);
      reset({ currentVersion: "1.0.0" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  const releaseMutation = useApiMutation<{ release: unknown }, ReleaseValues>(
    () => `/api/admin/products/${releaseTarget?.id}/releases`,
    { invalidateKeys: [PRODUCTS_KEY] },
  );

  const {
    register: registerRelease,
    handleSubmit: handleSubmitRelease,
    reset: resetRelease,
  } = useForm<ReleaseValues>({ resolver: zodResolver(releaseSchema) });

  async function onCreateRelease(values: ReleaseValues) {
    try {
      await releaseMutation.mutateAsync(values);
      toast.success("نسخه جدید منتشر شد.");
      setReleaseTarget(null);
      resetRelease();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطایی رخ داد.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">محصولات</h2>
          <p className="text-muted-foreground text-sm">پلاگین‌های تولیدشده توسط فکتوری وردپرس</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> محصول جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>محصول جدید</DialogTitle>
              <DialogDescription>شناسه باید با spec.slug فایل اسپک پلاگین یکسان باشد.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">نام محصول</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="slug">شناسه (slug)</Label>
                <Input id="slug" dir="ltr" placeholder="store-health" {...register("slug")} />
                {errors.slug && <p className="text-destructive text-xs">{errors.slug.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="currentVersion">نسخه اولیه</Label>
                <Input id="currentVersion" dir="ltr" {...register("currentVersion")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">توضیحات</Label>
                <Input id="description" {...register("description")} />
              </div>
              <DialogFooter>
                <Button type="submit" loading={createMutation.isPending}>
                  ایجاد محصول
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
          ) : products.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
              <Package className="size-8" />
              هنوز محصولی ثبت نشده است.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>شناسه</TableHead>
                  <TableHead>نسخه فعلی</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ ایجاد</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {product.slug}
                    </TableCell>
                    <TableCell dir="ltr">{product.currentVersion}</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "success" : "secondary"}>
                        {product.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(product.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setReleaseTarget(product)}>
                        <Rocket className="size-3.5" /> نسخه جدید
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(releaseTarget)} onOpenChange={(open) => !open && setReleaseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>انتشار نسخه جدید — {releaseTarget?.name}</DialogTitle>
            <DialogDescription>
              فایل ZIP ساخته‌شده با tools/build.php را در یک محل قابل‌دسترس آپلود کرده و آدرس آن را
              وارد کنید.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRelease(onCreateRelease)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="version">شماره نسخه</Label>
              <Input id="version" dir="ltr" placeholder="1.1.0" {...registerRelease("version")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="packageUrl">آدرس فایل ZIP</Label>
              <Input
                id="packageUrl"
                dir="ltr"
                placeholder="https://cdn.example.com/store-health-1.1.0.zip"
                {...registerRelease("packageUrl")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="changelog">تغییرات نسخه</Label>
              <Input id="changelog" {...registerRelease("changelog")} />
            </div>
            <DialogFooter>
              <Button type="submit" loading={releaseMutation.isPending}>
                انتشار
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
