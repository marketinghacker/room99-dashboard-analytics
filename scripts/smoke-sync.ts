/**
 * Smoke test syncs against live MCP servers. Runs a single platform end-to-end.
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/smoke-sync.ts <platform>
 */
const platform = process.argv[2];
if (!platform) {
  console.error('Usage: smoke-sync.ts <meta|google|criteo|ga4>');
  process.exit(1);
}

console.log(`Running sync for ${platform}...`);
const t0 = Date.now();

let result: { rowsWritten: number };
switch (platform) {
  case 'meta': {
    const { syncMeta } = await import('../src/lib/sync/meta.ts');
    result = await syncMeta();
    break;
  }
  case 'google': {
    const { syncGoogleAds } = await import('../src/lib/sync/google-ads.ts');
    result = await syncGoogleAds({ start: daysAgo(30), end: daysAgo(1) });
    break;
  }
  case 'criteo': {
    const { syncCriteo } = await import('../src/lib/sync/criteo.ts');
    result = await syncCriteo({ start: daysAgo(30), end: daysAgo(1) });
    break;
  }
  case 'ga4': {
    const { syncGA4 } = await import('../src/lib/sync/ga4.ts');
    result = await syncGA4({ start: daysAgo(30), end: daysAgo(1) });
    break;
  }
  case 'pinterest': {
    const { syncPinterest } = await import('../src/lib/sync/pinterest.ts');
    result = await syncPinterest({ start: daysAgo(30), end: daysAgo(1) });
    break;
  }
  default:
    console.error(`Unknown platform: ${platform}`);
    process.exit(1);
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n✓ ${platform}: ${result.rowsWritten} rows in ${elapsed}s`);
process.exit(0);

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toISOString().slice(0, 10);
}
