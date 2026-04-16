import { type NextRequest } from 'next/server';
import { getData, initDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';

  try {
    await initDb();
    const periodKey = `${start}_${end}`;
    const result = await getData('criteo', periodKey);

    if (result) {
      return Response.json({ data: result.data, lastUpdated: result.fetchedAt, cached: true });
    }

    return Response.json({ data: null, lastUpdated: null, cached: false, message: 'Brak danych dla tego okresu. Uruchom synchronizacje: /api/cron/sync' });
  } catch (error) {
    console.error('criteo error:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'criteo read failed' }, { status: 500 });
  }
}
