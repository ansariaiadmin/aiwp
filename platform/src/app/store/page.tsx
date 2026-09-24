import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productPlans, products } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreHeader } from "@/components/store/store-header";
import { formatPriceWithToman } from "@/lib/money";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "فروشگاه",
  description: "خرید لایسنس محصولات AiWp — پرداخت امن، دریافت آنی کلید لایسنس.",
  // The storefront is the public face of the product: unlike the admin
  // panel it must be crawlable.
  robots: { index: true, follow: true },
};

export default async function StorePage() {
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true));

  const planRows = await db
    .select()
    .from(productPlans)
    .where(eq(productPlans.isActive, true))
    .orderBy(asc(productPlans.sortOrder), asc(productPlans.price));

  const catalogue = productRows
    .map((product) => ({
      product,
      plans: planRows.filter((plan) => plan.productId === product.id),
    }))
    .filter((entry) => entry.plans.length > 0);

  return (
    <div className="bg-background min-h-svh">
      <StoreHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="mb-10 flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-bold">فروشگاه AiWp</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl">
            لایسنس محصولات را بخرید و کلید فعال‌سازی را بلافاصله پس از پرداخت در داشبورد خود
            دریافت کنید.
          </p>
        </header>

        {catalogue.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              هنوز محصول قابل فروشی منتشر نشده است.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {catalogue.map(({ product, plans }) => {
              const cheapest = plans.reduce((min, plan) => (plan.price < min.price ? plan : min));

              return (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {product.name}
                      <Badge variant="secondary">نسخه {product.currentVersion}</Badge>
                    </CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">
                        از {formatNumber(plans.length)} پلن
                      </span>
                      <span className="text-primary text-lg font-bold">
                        {formatPriceWithToman(cheapest.price, cheapest.currency)}
                      </span>
                    </div>
                    <Button asChild>
                      <Link href={`/store/${product.slug}`}>مشاهده و خرید</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
