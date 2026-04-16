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

/** BaseLinker order-source buckets we sync. Values match the `filter_order_source`
 *  name accepted by `get_daily_revenue`. `all` = no filter. */
export const SELLROCKET_SOURCES = {
  all: null,        // no filter → total across all channels
  shr: 'SHR',       // Shoper = Room99.pl own shop (agency primary KPI)
  allegro: 'ALLEGRO', // Allegro marketplace benchmark
} as const;

export type SellRocketSource = keyof typeof SELLROCKET_SOURCES;

type DailyRevenue = {
  date?: string;
  order_count?: number;
  revenue?: number;
  avg_order_value?: number;
};

function enumerateDates(range: DateRange): string[] {
  const out: string[] = [];
  const start = new Date(range.start + 'T00:00:00Z');
  const end = new Date(range.end + 'T00:00:00Z');
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export async function syncSellRocket(
  range: DateRange,
  opts: { db?: DB; concurrency?: number; sources?: SellRocketSource[] } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  // BaseLinker paginated revenue scans are slow (~10-30s/day for busy shops).
  // Sequential is actually faster in practice (avoids request queueing).
  const concurrency = opts.concurrency ?? 1;
  const sources = opts.sources ?? (Object.keys(SELLROCKET_SOURCES) as SellRocketSource[]);

  const dates = enumerateDates(range);
  const client = await connectMCP(MCP_URL, 'sse');

  type Job = { date: string; sourceKey: SellRocketSource };
  const jobs: Job[] = [];
  for (const date of dates) {
    for (const sourceKey of sources) {
      jobs.push({ date, sourceKey });
    }
  }

  try {
    const results: Array<{ date: string; sourceKey: SellRocketSource; rev: DailyRevenue }> = [];

    let idx = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (idx < jobs.length) {
        const job = jobs[idx++];
        const filterName = SELLROCKET_SOURCES[job.sourceKey];
        try {
          const args: Record<string, unknown> = { date: job.date };
          // Do NOT pass status_id — the MCP server's "0 = all" claim is wrong,
          // status_id=0 filters to status=0 (which returns zero orders).
          if (filterName) args.filter_order_source = filterName;

          const rev = await callMCPTool<DailyRevenue>(
            client,
            'get_daily_revenue',
            args,
            { retries: 2, initialBackoffMs: 800, timeoutMs: 300_000 }
          );
          results.push({ date: job.date, sourceKey: job.sourceKey, rev });
        } catch (err) {
          console.warn(`[sellrocket] ${job.date}/${job.sourceKey} failed: ${(err as Error).message}`);
        }
      }
    });
    await Promise.all(workers);

    const rows = results
      .filter((r) => r.rev && r.rev.date)
      .map((r) => ({
        date: r.rev.date!,
        source: r.sourceKey,
        orderCount: r.rev.order_count ?? 0,
        revenue: String(r.rev.revenue ?? 0),
        avgOrderValue: String(r.rev.avg_order_value ?? 0),
      }));

    if (rows.length > 0) {
      await database
        .insert(sellrocketDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [sellrocketDaily.date, sellrocketDaily.source],
          set: {
            orderCount: sql`excluded.order_count`,
            revenue: sql`excluded.revenue`,
            avgOrderValue: sql`excluded.avg_order_value`,
            updatedAt: sql`now()`,
          },
        });
    }

    return { rowsWritten: rows.length };
  } finally {
    await client.close();
  }
}
