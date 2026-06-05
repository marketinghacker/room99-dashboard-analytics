-- GA4 funnel-by-users + micro-conversions (event_name × device × user_type)
-- and per-product GA4 traffic. Feeds: Lejek tab, mikrokonwersje, Top produkty.
CREATE TABLE IF NOT EXISTS "ga4_funnel_daily" (
  "date" date NOT NULL,
  "event_name" text NOT NULL,
  "device" text NOT NULL DEFAULT 'all',
  "user_type" text NOT NULL DEFAULT 'all',
  "users" integer NOT NULL DEFAULT 0,
  "event_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ga4_funnel_daily_pk" PRIMARY KEY ("date", "event_name", "device", "user_type")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ga4_funnel_daily_date_idx" ON "ga4_funnel_daily" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ga4_funnel_daily_event_idx" ON "ga4_funnel_daily" ("event_name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ga4_product_daily" (
  "date" date NOT NULL,
  "item_id" text NOT NULL,
  "item_name" text NOT NULL,
  "items_viewed" integer NOT NULL DEFAULT 0,
  "add_to_carts" integer NOT NULL DEFAULT 0,
  "items_purchased" integer NOT NULL DEFAULT 0,
  "revenue" numeric(14,4) NOT NULL DEFAULT '0',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ga4_product_daily_pk" PRIMARY KEY ("date", "item_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ga4_product_daily_date_idx" ON "ga4_product_daily" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ga4_product_daily_name_idx" ON "ga4_product_daily" ("item_name");
