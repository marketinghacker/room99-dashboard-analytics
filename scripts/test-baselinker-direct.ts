/**
 * Verify direct BaseLinker API works for Room99 + computes April 1-16 totals
 * per source_id. Expected: Room99_Official (id=8) ≈ 916 030,73 zł.
 */
import { BaseLinkerAPI } from '../src/lib/sync/baselinker-api.ts';

const token = process.env.BASELINKER_API_TOKEN;
const url = process.env.BASELINKER_API_URL;
if (!token) { console.error('BASELINKER_API_TOKEN missing'); process.exit(1); }

const api = new BaseLinkerAPI(token, url);

// Sanity check: list sources
console.log('=== Order sources ===');
const srcs: any = await api.call('getOrderSources');
const byCat = srcs.sources ?? {};
for (const [cat, subs] of Object.entries(byCat)) {
  for (const [id, name] of Object.entries(subs as Record<string, string>)) {
    console.log(`  ${cat.padEnd(20)} id=${String(id).padEnd(8)} ${name}`);
  }
}

// Fetch April 1-16 per source
console.log('\n=== April 1-16 per source_id ===');
const fromTs = Math.floor(new Date('2026-04-01T00:00:00Z').getTime() / 1000);
const toTs = Math.floor(new Date('2026-04-16T23:59:59Z').getTime() / 1000);

const targets = [
  { sourceType: 'SHR', sourceId: 9,  name: 'SHR / Room99.pl' },
  { sourceType: 'ALL', sourceId: 8,  name: 'ALL / Room99_Official' },
  { sourceType: 'ALL', sourceId: 7,  name: 'ALL / e_homeconcept' },
];

for (const t of targets) {
  const orders = await api.getOrdersRange({ fromTs, toTs, sourceType: t.sourceType, sourceId: t.sourceId });
  const revenue = orders.reduce(
    (s, o) => s + o.products.reduce((a, p) => a + p.price_brutto * p.quantity, 0) + Number(o.delivery_price ?? 0),
    0,
  );
  console.log(`  ${t.sourceType}/${t.sourceId}  ${t.name.padEnd(22)} → ${orders.length} orders  ${revenue.toFixed(2)} zł`);
}
