-- Pinterest sync now reads directly from Pinterest API v5 via MCP
-- (mh-connector). The Windsor.ai-managed sink table is no longer used.
--
-- Cleanup is two-step because the Windsor reader stored campaign NAMES as
-- campaign_id (it never had Pinterest's numeric IDs available), so the
-- legacy rows in ads_daily would not collide with the MCP rows on UPSERT
-- and would silently double the Pinterest spend on the dashboard.

-- 1. Drop the Windsor sink table.
DROP TABLE IF EXISTS "ad_performance_daily";

-- 2. Remove legacy Pinterest rows from ads_daily (campaign_id was the
--    Windsor-era campaign name, never numeric).
DELETE FROM "ads_daily"
WHERE platform='pinterest' AND campaign_id !~ '^[0-9]+$';

-- 3. Invalidate Pinterest + cross-platform cache entries so the next rollup
--    rebuilds them from the now-clean ads_daily contents.
DELETE FROM "dashboard_cache" WHERE platform IN ('pinterest', 'all');
