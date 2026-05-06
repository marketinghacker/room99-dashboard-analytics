import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/sales-tree-query', () => ({
  fetchSalesTreeRows: vi.fn().mockResolvedValue([
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'A',
      product_name: 'A name', revenue: 100, quantity: 1, orders: 1,
      revenue_prev: 80, daily: [50, 50] },
  ]),
}));

describe('GET /api/data/sales-tree', () => {
  it('returns 400 when start/end missing', async () => {
    const req = new Request('http://x/api/data/sales-tree');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns tree structure for valid request', async () => {
    const req = new Request('http://x/api/data/sales-tree?start=2026-04-01&end=2026-04-02');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].source).toBe('shr');
    expect(body.channels[0].metrics.revenue).toBe(100);
  });

  it('shifts compare period to previous same-length window when not provided', async () => {
    const { fetchSalesTreeRows } = await import('@/lib/sales-tree-query');
    const mock = fetchSalesTreeRows as unknown as ReturnType<typeof vi.fn>;
    mock.mockClear();
    const req = new Request('http://x/api/data/sales-tree?start=2026-04-15&end=2026-04-21');
    await GET(req);
    expect(mock).toHaveBeenCalledWith(expect.objectContaining({
      start: '2026-04-15', end: '2026-04-21',
      compareStart: '2026-04-08', compareEnd: '2026-04-14',
      channels: ['shr', 'allegro'],
    }));
  });

  it('respects channels query param', async () => {
    const { fetchSalesTreeRows } = await import('@/lib/sales-tree-query');
    const mock = fetchSalesTreeRows as unknown as ReturnType<typeof vi.fn>;
    mock.mockClear();
    const req = new Request('http://x/api/data/sales-tree?start=2026-04-01&end=2026-04-02&channels=shr');
    await GET(req);
    expect(mock).toHaveBeenCalledWith(expect.objectContaining({ channels: ['shr'] }));
  });
});
