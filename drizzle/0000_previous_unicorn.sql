-- ad_performance_daily is managed by Windsor.ai and already exists; skip CREATE TABLE.
CREATE TABLE IF NOT EXISTS "ads_daily" (
	"date" date NOT NULL,
	"platform" text NOT NULL,
	"account_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"campaign_status" text,
	"campaign_objective" text,
	"ad_group_id" text,
	"ad_group_name" text,
	"spend" numeric(14, 4) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(10, 6),
	"cpc" numeric(10, 4),
	"cpm" numeric(10, 4),
	"conversions" numeric(14, 4) DEFAULT '0',
	"conversion_value" numeric(14, 4) DEFAULT '0',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ads_daily_date_platform_campaign_id_pk" PRIMARY KEY("date","platform","campaign_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_cache" (
	"period_key" text NOT NULL,
	"platform" text NOT NULL,
	"compare_key" text DEFAULT 'none' NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_cache_period_key_platform_compare_key_pk" PRIMARY KEY("period_key","platform","compare_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ga4_daily" (
	"date" date NOT NULL,
	"channel_group" text NOT NULL,
	"source" text NOT NULL,
	"medium" text NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"users" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"engaged_sessions" integer DEFAULT 0 NOT NULL,
	"bounce_rate" numeric(6, 4),
	"transactions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 4) DEFAULT '0' NOT NULL,
	"items_viewed" integer DEFAULT 0 NOT NULL,
	"add_to_cart" integer DEFAULT 0 NOT NULL,
	"begin_checkout" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ga4_daily_date_channel_group_source_medium_pk" PRIMARY KEY("date","channel_group","source","medium")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"rows_written" integer DEFAULT 0,
	"error" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_daily_platform_date_idx" ON "ads_daily" USING btree ("platform","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_daily_date_idx" ON "ads_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ga4_daily_date_idx" ON "ga4_daily" USING btree ("date");