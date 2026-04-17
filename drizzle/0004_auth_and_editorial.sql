-- Auth users + editorial copy (masthead overrides) + thumbnail URL on products_daily.
-- Idempotent via IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editorial_copy" (
	"tab" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "editorial_copy_tab_key_pk" PRIMARY KEY("tab","key")
);
--> statement-breakpoint
ALTER TABLE "products_daily" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
