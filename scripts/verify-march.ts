/**
 * Verify March 2026 totals in sellrocket_daily against user-provided references.
 * Reference (Marcin, agency owner):
 *   SHR  2 985 968.37 PLN
 *   ALL  2 402 441.89 PLN
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const REF = {
  shr: 2_985_968.37,
  allegro: 2_402_441.89,
};

const res = await pool.query(`
  SELECT source, SUM(revenue)::float AS revenue, SUM(order_count)::int AS orders
  FROM sellrocket_daily
  WHERE date >= '2026-03-01' AND date <= '2026-03-31'
  GROUP BY source
  ORDER BY source;
`);

console.log('March 2026 totals in sellrocket_daily:');
console.table(res.rows);

const got = Object.fromEntries(res.rows.map((r) => [r.source, Number(r.revenue)]));

console.log('\nComparison to reference:');
for (const [src, ref] of Object.entries(REF)) {
  const g = got[src];
  if (g == null) {
    console.log(`  ${src.padEnd(8)}  reference=${ref.toFixed(2)}  actual=MISSING`);
    continue;
  }
  const diff = g - ref;
  const pct = (diff / ref) * 100;
  const ok = Math.abs(pct) < 1; // within 1%
  console.log(
    `  ${src.padEnd(8)}  reference=${ref.toFixed(2).padStart(12)}  actual=${g.toFixed(2).padStart(12)}  diff=${diff.toFixed(2).padStart(10)} (${pct.toFixed(2)}%)  ${ok ? '✓' : '✗'}`,
  );
}

await pool.end();
