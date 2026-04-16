import { describe, it, expect } from 'vitest';
import { startTestDB, isDockerAvailable } from './db-container';
import { adsDaily } from '@/lib/schema';

const dockerOk = await isDockerAvailable();

describe.skipIf(!dockerOk)('testcontainers db-container', () => {
  it('can connect and query empty ads_daily', async () => {
    const { db, stop } = await startTestDB();
    const rows = await db.select().from(adsDaily);
    expect(rows).toEqual([]);
    await stop();
  }, 60_000);
});

describe.skipIf(dockerOk)('testcontainers (SKIPPED — Docker not running)', () => {
  it.skip('integration tests skipped', () => {});
});
