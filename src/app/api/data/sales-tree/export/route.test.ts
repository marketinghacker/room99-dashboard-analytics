import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/sales-tree-query', () => ({
  fetchSalesTreeRows: vi.fn().mockResolvedValue([
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'A',
      product_name: 'A name', revenue: 100, quantity: 1, orders: 1,
      revenue_prev: 80, daily: [50, 50] },
  ]),
}));

describe('GET /api/data/sales-tree/export', () => {
  it('returns 400 when start/end missing', async () => {
    const req = new Request('http://x/api/data/sales-tree/export?format=csv');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns CSV with BOM + semicolon separators + Polish header', async () => {
    const req = new Request('http://x/api/data/sales-tree/export?format=csv&start=2026-04-01&end=2026-04-02');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('.csv');
    // Read raw bytes — Response.text() in spec-compliant fetch strips a leading
    // UTF-8 BOM, so we verify the bytes directly. The BOM is critical for Excel
    // to detect UTF-8 encoding when opening the CSV.
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0xEF); // BOM byte 1
    expect(buf[1]).toBe(0xBB); // BOM byte 2
    expect(buf[2]).toBe(0xBF); // BOM byte 3
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
    expect(text.charCodeAt(0)).toBe(0xFEFF); // BOM
    const lines = text.slice(1).split('\n').filter(Boolean);
    expect(lines[0]).toContain('Kanał;Kategoria;Kolekcja');
    // Verify product row has all fields, semicolon-separated
    expect(lines[1]).toContain('Shoper');
    expect(lines[1]).toContain('NARZUTA');
    expect(lines[1]).toContain('MOLLY');
    expect(lines[1]).toContain('A name');
    expect(lines[1]).toContain(';A;'); // SKU
  });

  it('returns 400 for unknown format', async () => {
    const req = new Request('http://x/api/data/sales-tree/export?format=pdf&start=2026-04-01&end=2026-04-02');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
