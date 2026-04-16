/**
 * Build dashboard_cache from current ads_daily + ga4_daily data.
 * Usage: node --env-file=.env.local --import=tsx scripts/run-rollup.ts
 */
import { buildRollups } from '../src/lib/rollup.ts';

console.log('Building rollups...');
const t0 = Date.now();
const { cached } = await buildRollups();
console.log(`✓ Cached ${cached} entries in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
