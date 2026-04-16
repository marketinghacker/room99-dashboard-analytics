import { readPinterestRange } from '../src/lib/sync/pinterest.ts';

const rows = await readPinterestRange({ start: '2026-03-17', end: '2026-04-15' });
console.log(`Read ${rows.length} pinterest rows.`);
console.log('Sample 3:');
rows.slice(0, 3).forEach(r => console.log(' ', r));

const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
const totalRev = rows.reduce((s, r) => s + r.conversionValue, 0);
console.log(`\nTotal spend: ${totalSpend.toFixed(2)} PLN`);
console.log(`Total conv value: ${totalRev.toFixed(2)} PLN`);

process.exit(0);
