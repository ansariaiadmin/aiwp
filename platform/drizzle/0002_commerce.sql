CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway" AS ENUM('mock', 'zarinpal', 'stripe');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"product_name" text NOT NULL,
	"plan_name" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"max_activations" integer DEFAULT 1 NOT NULL,
	"duration_days" integer,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"gateway_ref_id" text,
	"gateway_meta" jsonb,
	"license_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" bigint NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"max_activations" integer DEFAULT 1 NOT NULL,
	"duration_days" integer,
	"support_days" integer DEFAULT 180 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_product_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."product_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_plans" ADD CONSTRAINT "product_plans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_product_id_idx" ON "orders" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_gateway_ref_idx" ON "orders" USING btree ("gateway_ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_plans_unique_idx" ON "product_plans" USING btree ("product_id","slug");--> statement-breakpoint
CREATE INDEX "product_plans_product_id_idx" ON "product_plans" USING btree ("product_id");