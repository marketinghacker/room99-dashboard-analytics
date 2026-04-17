CREATE TABLE IF NOT EXISTS "order_status_config" (
	"status_id" integer PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"source_type" text,
	"is_valid_sale" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
