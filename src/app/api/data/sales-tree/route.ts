import { fetchSalesTreeRows } from '@/lib/sales-tree-query';
import { buildSalesTree } from '@/lib/sales-tree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shiftPrevPeriod(start: string, end: string): { compareStart: string; compareEnd: string } {
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) {
    return Response.json({ error: 'start and end query params required (YYYY-MM-DD)' }, { status: 400 });
  }
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['shr', 'allegro'];

  const compStart = url.searchParams.get('compareStart');
  const compEnd = url.searchParams.get('compareEnd');
  const { compareStart, compareEnd } = compStart && compEnd
    ? { compareStart: compStart, compareEnd: compEnd }
    : shiftPrevPeriod(start, end);

  try {
    const rows = await fetchSalesTreeRows({ start, end, compareStart, compareEnd, channels });
    const channelsTree = buildSalesTree(rows);
    return Response.json({
      channels: channelsTree,
      period: { start, end },
      compare: { start: compareStart, end: compareEnd },
      count: rows.length,
    });
  } catch (err) {
    console.error('sales-tree route error', err);
    return Response.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
