import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productPlans, products } from "@/lib/db/schema";
import { StoreHeader } from "@/components/store/store-header";
import { BuyPlans, type StorePlan } from "@/components/store/buy-plans";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const rows = await db.select({ name: products.name }).from(products).where(eq(products.slug, slug)).limit(1);

  return {
    title: rows[0]?.name ?? "محصول",
    robots: { index: true, follow: true },
  };
}

export default async function StoreProductPage({ params }: Props) {
  const { slug } = await params;

  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  const product = productRows[0];

  if (!product || !product.isActive) notFound();

  const plans = await db
    .select()
    .from(productPlans)
    .where(eq(productPlans.productId, product.id))
    .orderBy(asc(productPlans.sortOrder), asc(productPlans.price));

  const activePlans: StorePlan[] = plans
    .filter((plan) => plan.isActive)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      maxActivations: plan.maxActivations,
      durationDays: plan.durationDays,
      supportDays: plan.supportDays,
      isFeatured: plan.isFeatured,
    }));

  return (
    <div className="bg-background min-h-svh">
      <StoreHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-3">
          <Link href="/store" className="text-muted-foreground text-sm hover:underline">
            → بازگشت به فروشگاه
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <Badge variant="secondary">نسخه {product.currentVersion}</Badge>
          </div>
          {product.description ? (
            <p className="text-muted-foreground max-w-3xl">{product.description}</p>
          ) : null}
        </header>

        <BuyPlans plans={activePlans} />
      </main>
    </div>
  );
}
