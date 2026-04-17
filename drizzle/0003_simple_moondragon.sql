CREATE TABLE IF NOT EXISTS "products_daily" (
	"date" date NOT NULL,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"category" text,
	"collection" text,
	"source" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 4) DEFAULT '0' NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_daily_date_sku_source_pk" PRIMARY KEY("date","sku","source")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_daily_sku_idx" ON "products_daily" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_daily_category_idx" ON "products_daily" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_daily_collection_idx" ON "products_daily" USING btree ("collection");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_daily_date_idx" ON "products_daily" USING btree ("date");