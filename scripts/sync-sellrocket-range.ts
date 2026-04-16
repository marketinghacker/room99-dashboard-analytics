/**
 * Sync SellRocket for an explicit date range (e.g. a full calendar month).
 * Usage:
 *   node --env-file=.env.local --import=tsx scripts/sync-sellrocket-range.ts \
 *     2026-03-01 2026-03-31 shr,allegro
 */
import { syncSellRocket } from '../src/lib/sync/sellrocket.ts';

const [, , start, end, sourcesArg] = process.argv;
if (!start || !end) {
  console.error('Usage: sync-sellrocket-range.ts YYYY-MM-DD YYYY-MM-DD [sources]');
  process.exit(1);
}
const sources = sourcesArg ? (sourcesArg.split(',') as any) : undefined;

console.log(`Syncing SellRocket ${start}..${end}  sources=${sources?.join(',') ?? 'shr,allegro'}`);
const t0 = Date.now();
const { rowsWritten } = await syncSellRocket({ start, end }, { sources });
console.log(`\n✓ Wrote ${rowsWritten} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
