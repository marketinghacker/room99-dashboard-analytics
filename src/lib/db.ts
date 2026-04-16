import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL not configured');
  return neon(url);
}

/** Initialize the dashboard_data table if it doesn't exist */
export async function initDb() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_data (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      period_key VARCHAR(100) NOT NULL,
      data JSONB NOT NULL,
      fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(platform, period_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboard_platform_period ON dashboard_data(platform, period_key)`;
}

/** Save data for a platform + period */
export async function saveData(platform: string, periodKey: string, data: unknown) {
  const sql = getDb();
  await sql`
    INSERT INTO dashboard_data (platform, period_key, data, fetched_at)
    VALUES (${platform}, ${periodKey}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (platform, period_key)
    DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, fetched_at = NOW()
  `;
}

/** Get data for a platform + period */
export async function getData(platform: string, periodKey: string): Promise<{ data: unknown; fetchedAt: string } | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT data, fetched_at FROM dashboard_data
    WHERE platform = ${platform} AND period_key = ${periodKey}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { data: rows[0].data, fetchedAt: rows[0].fetched_at as string };
}

/** Get all data for a period (all platforms) */
export async function getAllData(periodKey: string): Promise<Record<string, unknown>> {
  const sql = getDb();
  const rows = await sql`
    SELECT platform, data, fetched_at FROM dashboard_data
    WHERE period_key = ${periodKey}
  `;
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.platform as string] = row.data;
  }
  return result;
}

/** Check when data was last fetched for a period */
export async function lastFetchedAt(periodKey: string): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT MAX(fetched_at) as last_fetch FROM dashboard_data
    WHERE period_key = ${periodKey}
  `;
  return rows[0]?.last_fetch as string | null;
}
