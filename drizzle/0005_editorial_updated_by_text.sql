-- editorial_copy.updated_by was uuid (FK to users.id in the old email+password
-- model). With two-password auth we only have a role string ('agency' /
-- 'client') — migrate the column to text and drop any stale uuid data.

ALTER TABLE "editorial_copy"
  ALTER COLUMN "updated_by" DROP DEFAULT,
  ALTER COLUMN "updated_by" TYPE text USING updated_by::text;
