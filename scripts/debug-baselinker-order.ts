/**
 * Dump all unique fields across orders to find any price/amount field we
 * haven't tried. Also check if SellRocket has a dedicated revenue endpoint.
 */
import { BaseLinkerAPI } from '../src/lib/sync/baselinker-api.ts';

const token = process.env.BASELINKER_API_TOKEN!;
const url = process.env.BASELINKER_API_URL!;
const api = new BaseLinkerAPI(token, url);

const fromTs = Math.floor(new Date('2026-04-15T00:00:00Z').getTime() / 1000);
const toTs = Math.floor(new Date('2026-04-15T23:59:59Z').getTime() / 1000);

const orders: any[] = await api.getOrdersRange({ fromTs, toTs, sourceType: 'ALL', sourceId: 8 });
console.log(`${orders.length} orders`);

// Collect all unique keys
const keys = new Set<string>();
const productKeys = new Set<string>();
const samplesByKey: Record<string, any> = {};
for (const o of orders.slice(0, 100)) {
  for (const k of Object.keys(o)) {
    keys.add(k);
    if (samplesByKey[k] === undefined && o[k] !== '' && o[k] != null) {
      samplesByKey[k] = o[k];
    }
  }
  for (const p of o.products ?? []) {
    for (const k of Object.keys(p)) productKeys.add(k);
  }
}
console.log('\nAll order fields:');
for (const k of [...keys].sort()) {
  const sample = samplesByKey[k];
  const s = typeof sample === 'object' ? '[obj]' : String(sample).slice(0, 40);
  console.log(`  ${k.padEnd(28)} = ${s}`);
}
console.log('\nAll product fields:', [...productKeys].sort().join(', '));

// Also test listing orders REPORTS if available
console.log('\n=== Try getJournalList for status changes (cancellations) ===');
try {
  const j: any = await api.call('getJournalList', { last_log_id: 0, logs_types: [1, 2], order_id: 0 });
  console.log('Journal returned:', JSON.stringify(j).slice(0, 300));
} catch (e) { console.log('  not supported or empty'); }
