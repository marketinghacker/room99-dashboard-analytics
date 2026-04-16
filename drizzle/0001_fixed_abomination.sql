CREATE TABLE IF NOT EXISTS "sellrocket_daily" (
	"date" date NOT NULL,
	"source" text DEFAULT 'all' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 4) DEFAULT '0' NOT NULL,
	"avg_order_value" numeric(14, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellrocket_daily_date_source_pk" PRIMARY KEY("date","source")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sellrocket_daily_date_idx" ON "sellrocket_daily" USING btree ("date");