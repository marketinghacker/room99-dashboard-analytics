/**
 * SellRocket (BaseLinker) sync — THE SOURCE OF TRUTH for actual sales.
 *
 * Room99 sells through multiple channels. The agency (Marketing Hackers) is
 * responsible for the own-shop only: Shoper = source code 'SHR'. Allegro
 * ('ALLEGRO') is captured separately as a benchmark. Everything else rolls up
 * to 'all' (the total).
 *
 * For each day in the range we call `get_daily_revenue` three times — once
 * unfiltered, once for SHR, once for Allegro. Idempotent: upserts on
 * (date, source).
 *
 * MCP: https://mcp-sellrocket.up.railway.app/mcp  (SSE)
 * Docs: https://baselinker.com/en-US/api/ — getOrders, get_order_sources
 */
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { sellrocketDaily } from '@/lib/schema';
import { callMCPTool, connectMCP } from './mcp-client';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_BASELINKER_URL || 'https://mcp-sellrocket.up.railway.app/mcp';

/**
 * BaseLinker order-source buckets we sync.
 *
 * Important: in BaseLinker, source **codes** are category names like 'ALL' (=Allegro),
 * 'SHR' (=Shoper), 'CENEO', 'EMP', 'ERLI', 'MORELE'. A call without `filter_order_source`
 * returns incorrectly-filtered data on some days (BaseLinker API quirk), so we never
 * rely on the un-filtered call — we sum per-source ourselves.
 */
export const SELLROCKET_SOURCES = {
  shr: 'SHR',         // Shoper = Room99.pl own shop (agency primary KPI)
  allegro: 'ALL',     // Allegro category (sources 7, 8 etc.)
  ceneo: 'CENEO',
  emp: 'EMP',
  erli: 'ERLI',
  morele: 'MORELE',
  emag: 'EMAG',
  shopee: 'SHOPEE',
  beel: 'BEEL',
  beelconnector: 'BEELCONNECTOR',
  os: 'OS',           // Osobiście/telefonicznie
  amazon_de: 'Amazon Vendor DE',
} as const;

export type SellRocketSource = keyof typeof SELLROCKET_SOURCES;

/** Minimum sources we always sync — covers >95% of agency-relevant revenue. */
export const DEFAULT_SOURCES: SellRocketSource[] = ['shr', 'allegro'];

type DailyRevenue = {
  date?: string;
  order_count?: number;
  revenue?: number;
  avg_order_value?: number;
};

function enumerateDates(range: DateRange, reverse = false): string[] {
  const out: string[] = [];
  const start = new Date(range.start + 'T00:00:00Z');
  const end = new Date(range.end + 'T00:00:00Z');
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return reverse ? out.reverse() : out;
}

export async function syncSellRocket(
  range: DateRange,
  opts: { db?: DB; concurrency?: number; sources?: SellRocketSource[]; newestFirst?: boolean } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const concurrency = opts.concurrency ?? 1;
  const sources = opts.sources ?? DEFAULT_SOURCES;
  // Default: newest-first so the user's "today" / "last week" populate first.
  const dates = enumerateDates(range, opts.newestFirst ?? true);

  const upsertOne = async (row: typeof sellrocketDaily.$inferInsert) => {
    await database
      .insert(sellrocketDaily)
      .values(row)
      .onConflictDoUpdate({
        target: [sellrocketDaily.date, sellrocketDaily.source],
        set: {
          orderCount: sql`excluded.order_count`,
          revenue: sql`excluded.revenue`,
          avgOrderValue: sql`excluded.avg_order_value`,
          updatedAt: sql`now()`,
        },
      });
  };

  const t0 = Date.now();

  // Run one MCP connection PER source — this parallelizes the slow BaseLinker
  // pagination across sources without queueing requests on the same SSE stream
  // (which timed out with concurrency>1 on a single connection).
  const perSourceTotals = await Promise.all(
    sources.map(async (sourceKey) => {
      const client = await connectMCP(MCP_URL, 'sse');
      const filterName = SELLROCKET_SOURCES[sourceKey];
      let written = 0;
      try {
        for (const date of dates) {
          try {
            const args: Record<string, unknown> = { date };
            if (filterName) args.filter_order_source = filterName;

            const rev = await callMCPTool<DailyRevenue>(
              client,
              'get_daily_revenue',
              args,
              { retries: 2, initialBackoffMs: 800, timeoutMs: 300_000 }
            );

            if (rev && rev.date) {
              await upsertOne({
                date: rev.date,
                source: sourceKey,
                orderCount: rev.order_count ?? 0,
                revenue: String(rev.revenue ?? 0),
                avgOrderValue: String(rev.avg_order_value ?? 0),
              });
              written++;
              console.log(
                `[sellrocket] ${date}/${sourceKey}: ${rev.order_count ?? 0} orders, ${(rev.revenue ?? 0).toFixed(2)} zł`,
              );
            }
          } catch (err) {
            console.warn(`[sellrocket] ${date}/${sourceKey} failed: ${(err as Error).message}`);
          }
        }
      } finally {
        await client.close();
      }
      return written;
    }),
  );

  const rowsWritten = perSourceTotals.reduce((a, b) => a + b, 0);
  console.log(`[sellrocket] total ${rowsWritten} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Recompute `all` rows from every source currently in the DB for this range.
  // This is always correct regardless of which subset was synced this run.
  await recomputeAllRows(database, range);

  return { rowsWritten };
}

/**
 * Derive the `all` row per date by summing every non-'all' source in the DB.
 * Idempotent; safe to call after any partial sync.
 */
export async function recomputeAllRows(database: DB, range: DateRange): Promise<void> {
  await database.execute(sql`
    INSERT INTO sellrocket_daily (date, source, order_count, revenue, avg_order_value, updated_at)
    SELECT
      date,
      'all',
      SUM(order_count)::int,
      SUM(revenue),
      CASE WHEN SUM(order_count) > 0
           THEN SUM(revenue) / SUM(order_count)
           ELSE 0 END,
      now()
    FROM sellrocket_daily
    WHERE source <> 'all'
      AND date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date
    ON CONFLICT (date, source) DO UPDATE
    SET order_count = EXCLUDED.order_count,
        revenue = EXCLUDED.revenue,
        avg_order_value = EXCLUDED.avg_order_value,
        updated_at = EXCLUDED.updated_at
  `);
}
