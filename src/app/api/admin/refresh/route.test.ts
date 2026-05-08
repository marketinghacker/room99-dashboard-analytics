/**
 * Tests for POST /api/admin/refresh — manual force-refresh endpoint.
 *
 * Mocks every sync function and buildRollups so we can drive the orchestration
 * deterministically without touching MCP servers / DB. We DO touch the real
 * run-tracker, which writes to sync_runs — that's mocked too.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set a stable session secret BEFORE @/lib/auth gets loaded by any mock or
// import — getSecret() reads it lazily, so this is fine here.
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-bytes-min-len';

// All mocks must be hoisted via vi.mock at module-eval time.
vi.mock('@/lib/sync/meta-graph', () => ({
  syncMetaGraph: vi.fn().mockResolvedValue({ rowsWritten: 10 }),
}));
vi.mock('@/lib/sync/google-ads', () => ({
  syncGoogleAds: vi.fn().mockResolvedValue({ rowsWritten: 20 }),
}));
vi.mock('@/lib/sync/criteo', () => ({
  syncCriteo: vi.fn().mockResolvedValue({ rowsWritten: 30 }),
}));
vi.mock('@/lib/sync/ga4', () => ({
  syncGA4: vi.fn().mockResolvedValue({ rowsWritten: 40 }),
}));
vi.mock('@/lib/sync/pinterest', () => ({
  syncPinterest: vi.fn().mockResolvedValue({ rowsWritten: 50 }),
}));
vi.mock('@/lib/sync/sellrocket', () => ({
  syncSellRocket: vi.fn().mockResolvedValue({ rowsWritten: 60 }),
}));
vi.mock('@/lib/sync/sellrocket-direct', () => ({
  syncSellRocketDirect: vi.fn().mockResolvedValue({ rowsWritten: 65 }),
}));
vi.mock('@/lib/sync/products', () => ({
  syncProducts: vi.fn().mockResolvedValue({ rowsWritten: 70 }),
}));
vi.mock('@/lib/rollup', () => ({
  buildRollups: vi.fn().mockResolvedValue({ cached: 100 }),
}));
vi.mock('@/lib/sync/run-tracker', () => ({
  startRun: vi.fn().mockResolvedValue('run-id-stub'),
  finishRun: vi.fn().mockResolvedValue(undefined),
  withTimeout: vi.fn(<T,>(p: Promise<T>) => p),
}));

// Sign a real JWT using the live SESSION_SECRET so the auth check passes.
import { signSession } from '@/lib/auth';

async function agencyCookie(): Promise<string> {
  const token = await signSession({ userId: 'u-test', role: 'agency', email: 'test@hackers' });
  return `r99-session=${token}`;
}
async function clientCookie(): Promise<string> {
  const token = await signSession({ userId: 'u-test', role: 'client', email: 'test@room99' });
  return `r99-session=${token}`;
}

function makeReq(body: unknown, cookie?: string): Request {
  return new Request('http://x/api/admin/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force MCP path for sellrocket (no BASELINKER_API_TOKEN). Tests that
    // need the direct path set the env explicitly.
    delete process.env.BASELINKER_API_TOKEN;
  });

  it('401 when no session cookie', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq({ sources: ['google_ads'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true }),
    );
    expect(res.status).toBe(401);
  });

  it('403 when client role', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['google_ads'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await clientCookie(),
      ),
    );
    expect(res.status).toBe(403);
  });

  it('400 when start > end', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['google_ads'], start: '2026-04-10', end: '2026-04-01', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start.*end/i);
  });

  it('400 when invalid date format', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['google_ads'], start: 'not-a-date', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(400);
  });

  it('400 when invalid source', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['unknown_source'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it('400 when sources is empty array', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: [], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(400);
  });

  it('runs single source successfully', async () => {
    const { POST } = await import('./route');
    const { syncGoogleAds } = await import('@/lib/sync/google-ads');
    const res = await POST(
      makeReq(
        { sources: ['google_ads'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]).toMatchObject({ source: 'google_ads', status: 'success', rowsWritten: 20 });
    expect(syncGoogleAds).toHaveBeenCalledWith({ start: '2026-04-01', end: '2026-04-07' });
    expect(body.rollup.rebuilt).toBe(true);
  });

  it('expands sources: ["all"] to the full list', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['all'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: false },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const sources = body.sources.map((s: { source: string }) => s.source).sort();
    expect(sources).toEqual(
      ['criteo', 'ga4', 'google_ads', 'meta', 'pinterest', 'products', 'sellrocket'].sort(),
    );
  });

  it('failed source still returns 200 with status=failed for that source', async () => {
    const { syncMetaGraph } = await import('@/lib/sync/meta-graph');
    (syncMetaGraph as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Meta API flaked'),
    );
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['meta', 'google_ads'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: false },
        await agencyCookie(),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false); // any failure flips ok flag
    const meta = body.sources.find((s: { source: string }) => s.source === 'meta');
    const ga = body.sources.find((s: { source: string }) => s.source === 'google_ads');
    expect(meta).toMatchObject({ status: 'failed', error: 'Meta API flaked' });
    expect(ga).toMatchObject({ status: 'success' });
  });

  it('rebuildRollups: false skips buildRollups', async () => {
    const { buildRollups } = await import('@/lib/rollup');
    const { POST } = await import('./route');
    await POST(
      makeReq(
        { sources: ['ga4'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: false },
        await agencyCookie(),
      ),
    );
    expect(buildRollups).not.toHaveBeenCalled();
  });

  it('rebuildRollups: true calls buildRollups exactly once', async () => {
    const { buildRollups } = await import('@/lib/rollup');
    const { POST } = await import('./route');
    await POST(
      makeReq(
        { sources: ['ga4', 'pinterest'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    expect(buildRollups).toHaveBeenCalledTimes(1);
  });

  it('uses syncSellRocketDirect when BASELINKER_API_TOKEN set', async () => {
    process.env.BASELINKER_API_TOKEN = 'test-token';
    const { syncSellRocketDirect } = await import('@/lib/sync/sellrocket-direct');
    const { syncSellRocket } = await import('@/lib/sync/sellrocket');
    const { POST } = await import('./route');
    await POST(
      makeReq(
        { sources: ['sellrocket'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: false },
        await agencyCookie(),
      ),
    );
    expect(syncSellRocketDirect).toHaveBeenCalled();
    expect(syncSellRocket).not.toHaveBeenCalled();
  });

  it('runs sources sequentially (not parallel)', async () => {
    const order: string[] = [];
    const { syncGoogleAds } = await import('@/lib/sync/google-ads');
    const { syncCriteo } = await import('@/lib/sync/criteo');
    (syncGoogleAds as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      order.push('google_ads:start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('google_ads:end');
      return { rowsWritten: 1 };
    });
    (syncCriteo as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      order.push('criteo:start');
      await new Promise((r) => setTimeout(r, 5));
      order.push('criteo:end');
      return { rowsWritten: 1 };
    });
    const { POST } = await import('./route');
    await POST(
      makeReq(
        { sources: ['google_ads', 'criteo'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: false },
        await agencyCookie(),
      ),
    );
    expect(order).toEqual([
      'google_ads:start',
      'google_ads:end',
      'criteo:start',
      'criteo:end',
    ]);
  });

  it('returns totalMs and per-source ms', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      makeReq(
        { sources: ['ga4'], start: '2026-04-01', end: '2026-04-07', rebuildRollups: true },
        await agencyCookie(),
      ),
    );
    const body = await res.json();
    expect(typeof body.totalMs).toBe('number');
    expect(typeof body.sources[0].ms).toBe('number');
    expect(typeof body.rollup.ms).toBe('number');
  });
});
