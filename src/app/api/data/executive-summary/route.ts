import { type NextRequest } from 'next/server';
import { getData, initDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';

  try {
    await initDb();
    const periodKey = `${start}_${end}`;

    // Try database first
    const [summary, ga4, gads, meta, criteo] = await Promise.all([
      getData('executive-summary', periodKey),
      getData('ga4', periodKey),
      getData('google-ads', periodKey),
      getData('meta-ads', periodKey),
      getData('criteo', periodKey),
    ]);

    const sumData = (summary?.data ?? {}) as Record<string, number>;
    const gadsData = (gads?.data ?? {}) as Record<string, unknown>;
    const metaData = (meta?.data ?? {}) as Record<string, unknown>;
    const criteoData = (criteo?.data ?? {}) as Record<string, unknown>;

    const totalSpend = Number(sumData.totalSpend ?? 0) ||
      (Number(gadsData.totalSpend ?? 0) + Number(metaData.totalSpend ?? 0) + Number(criteoData.totalSpend ?? 0));
    const sessions = Number(sumData.sessions ?? 0);
    const gSpend = Number(sumData.gadsSpend ?? gadsData.totalSpend ?? 0);
    const mSpend = Number(sumData.metaSpend ?? metaData.totalSpend ?? 0);
    const cSpend = Number(sumData.criteoSpend ?? criteoData.totalSpend ?? 0);

    const hasData = totalSpend > 0 || sessions > 0;

    const platformSpend = [
      { platform: 'google-ads', spend: Math.round(gSpend * 100) / 100, spendShare: totalSpend > 0 ? (gSpend / totalSpend) * 100 : 0 },
      { platform: 'meta-ads', spend: Math.round(mSpend * 100) / 100, spendShare: totalSpend > 0 ? (mSpend / totalSpend) * 100 : 0 },
      { platform: 'criteo', spend: Math.round(cSpend * 100) / 100, spendShare: totalSpend > 0 ? (cSpend / totalSpend) * 100 : 0 },
    ];

    const data = {
      revenue: { label: 'Przychód (SHR)', value: 0, format: 'currency' },
      aov: { label: 'AOV', value: 0, format: 'currency' },
      cr: { label: 'CR', value: 0, format: 'percent' },
      transactions: { label: 'Transakcje', value: 0, format: 'number' },
      sessions: { label: 'Sesje', value: sessions, format: 'number' },
      marketing: {
        totalSpend: { label: 'Wydatki reklamowe', value: Math.round(totalSpend * 100) / 100, format: 'currency' },
        costShare: { label: 'COS (Cost of Sale)', value: 0, format: 'percent' },
      },
      platformSpend,
      alerts: [],
      errors: {},
      _hasData: hasData,
      _lastSync: summary?.fetchedAt ?? null,
    };

    return Response.json({ data, lastUpdated: summary?.fetchedAt ?? new Date().toISOString(), cached: !!summary });
  } catch (error) {
    console.error('Executive summary error:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
