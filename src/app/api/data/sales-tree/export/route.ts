import { fetchSalesTreeRows } from '@/lib/sales-tree-query';
import { buildSalesTree, type FlatRow } from '@/lib/sales-tree';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADER = 'Kanał;Kategoria;Kolekcja;Nazwa produktu;SKU;Ilość;Zamówienia;Przychód;Zmiana %';

function pl(n: number, decimals = 2): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function chLabel(s: string) { return s === 'shr' ? 'Shoper' : s === 'allegro' ? 'Allegro' : s; }

function shiftPrev(start: string, end: string) {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const compareEnd = new Date(s.getTime() - 86400000);
  const compareStart = new Date(compareEnd.getTime() - (days - 1) * 86400000);
  return {
    compareStart: compareStart.toISOString().slice(0, 10),
    compareEnd: compareEnd.toISOString().slice(0, 10),
  };
}

function buildCsv(rows: FlatRow[]): Uint8Array {
  const lines = [HEADER];
  for (const r of rows) {
    const change = r.revenue_prev > 0 ? ((r.revenue - r.revenue_prev) / r.revenue_prev) * 100 : 0;
    lines.push([
      chLabel(r.source), r.category, r.collection,
      // Strip semicolons from free text to keep CSV well-formed
      (r.product_name ?? '').replace(/;/g, ','),
      r.sku,
      r.quantity, r.orders, pl(r.revenue), `${pl(change, 1)}%`,
    ].join(';'));
  }
  // BOM as raw UTF-8 bytes (EF BB BF) so it isn't stripped by fetch's decoder.
  const body = new TextEncoder().encode(lines.join('\n'));
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const out = new Uint8Array(bom.length + body.length);
  out.set(bom, 0);
  out.set(body, bom.length);
  return out;
}

async function buildXlsx(rows: FlatRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Room99 Dashboard';
  wb.created = new Date();

  // ----- Sheet 1: Drzewo (hierarchical with outline levels) -----
  const tree = buildSalesTree(rows);
  const treeSheet = wb.addWorksheet('Drzewo', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { outlineLevelRow: 0, outlineLevelCol: 0 },
  });
  treeSheet.columns = [
    { header: 'Poziom', key: 'level', width: 8 },
    { header: 'Nazwa', key: 'name', width: 40 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Ilość', key: 'qty', width: 10 },
    { header: 'Zamówienia', key: 'orders', width: 12 },
    { header: 'Przychód (PLN)', key: 'revenue', width: 16 },
    { header: 'Zmiana %', key: 'change', width: 11 },
  ];
  treeSheet.getRow(1).font = { bold: true };
  treeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE8DC' } };

  function addNodeRow(label: string, sku: string, depth: number, m: { quantity: number; orders: number; revenue: number; change: number }) {
    const r = treeSheet.addRow({ level: depth, name: label, sku, qty: m.quantity, orders: m.orders, revenue: m.revenue, change: m.change });
    r.outlineLevel = depth;
    if (depth < 3) r.font = { bold: true };
    r.getCell('revenue').numFmt = '#,##0.00';
    r.getCell('change').numFmt = '0.0"%"';
    if (m.change > 0.5) r.getCell('change').font = { color: { argb: 'FF6A8470' } };
    else if (m.change < -0.5) r.getCell('change').font = { color: { argb: 'FFA65D4E' } };
  }

  for (const ch of tree) {
    addNodeRow(chLabel(ch.source), '', 0, ch.metrics);
    for (const cat of ch.categories) {
      addNodeRow(cat.category, '', 1, cat.metrics);
      for (const col of cat.collections) {
        addNodeRow(col.collection, '', 2, col.metrics);
        for (const p of col.products) {
          addNodeRow(p.name, p.sku, 3, p.metrics);
        }
      }
    }
  }

  // ----- Sheet 2: Suma (flat) -----
  const flatSheet = wb.addWorksheet('Suma', { views: [{ state: 'frozen', ySplit: 1 }] });
  flatSheet.columns = [
    { header: 'Kanał', key: 'channel', width: 12 },
    { header: 'Kategoria', key: 'category', width: 18 },
    { header: 'Kolekcja', key: 'collection', width: 18 },
    { header: 'Nazwa produktu', key: 'name', width: 40 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Ilość', key: 'qty', width: 10 },
    { header: 'Zamówienia', key: 'orders', width: 12 },
    { header: 'Przychód (PLN)', key: 'revenue', width: 16 },
    { header: 'Zmiana %', key: 'change', width: 11 },
  ];
  flatSheet.getRow(1).font = { bold: true };
  flatSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE8DC' } };
  for (const r of rows) {
    const change = r.revenue_prev > 0 ? ((r.revenue - r.revenue_prev) / r.revenue_prev) * 100 : 0;
    const row = flatSheet.addRow({
      channel: chLabel(r.source), category: r.category, collection: r.collection,
      name: r.product_name, sku: r.sku, qty: r.quantity, orders: r.orders,
      revenue: r.revenue, change,
    });
    row.getCell('revenue').numFmt = '#,##0.00';
    row.getCell('change').numFmt = '0.0"%"';
    if (change > 0.5) row.getCell('change').font = { color: { argb: 'FF6A8470' } };
    else if (change < -0.5) row.getCell('change').font = { color: { argb: 'FFA65D4E' } };
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const format = url.searchParams.get('format') ?? 'csv';
  if (!start || !end) {
    return Response.json({ error: 'start/end required' }, { status: 400 });
  }
  if (format !== 'csv' && format !== 'xlsx') {
    return Response.json({ error: 'format must be csv or xlsx' }, { status: 400 });
  }

  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['shr', 'allegro'];

  const compStartParam = url.searchParams.get('compareStart');
  const compEndParam = url.searchParams.get('compareEnd');
  const { compareStart, compareEnd } = compStartParam && compEndParam
    ? { compareStart: compStartParam, compareEnd: compEndParam }
    : shiftPrev(start, end);

  try {
    const rows = await fetchSalesTreeRows({ start, end, compareStart, compareEnd, channels });
    if (format === 'csv') {
      return new Response(buildCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sales_${start}_${end}.csv"`,
        },
      });
    }
    // XLSX
    const buf = await buildXlsx(rows);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sales_${start}_${end}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('sales-tree export error', err);
    return Response.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
