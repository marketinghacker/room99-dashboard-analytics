import { type NextRequest } from 'next/server';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';
import { headers } from 'next/headers';

/** Resolve the base URL for internal API fetches */
function getBaseUrl(requestHeaders: Headers): string {
  const host = requestHeaders.get('host') || 'localhost:3000';
  const proto = requestHeaders.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

interface PlatformResponse {
  data?: Record<string, unknown>;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('executive-summary', { start, end });

  if (!refresh) {
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      return Response.json({
        data: cached,
        lastUpdated: cacheLastUpdated(cacheKey),
        cached: true,
      });
    }
  }

  try {
    const reqHeaders = await headers();
    const baseUrl = getBaseUrl(reqHeaders);
    const qs = new URLSearchParams();
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    if (refresh) qs.set('refresh', 'true');
    const queryString = qs.toString() ? `?${qs.toString()}` : '';

    // Fetch all 4 data sources in parallel
    const [ga4Res, gadsRes, metaRes, criteoRes, baselinkerRes] =
      await Promise.allSettled([
        fetch(`${baseUrl}/api/data/ga4${queryString}`).then((r) => r.json() as Promise<PlatformResponse>),
        fetch(`${baseUrl}/api/data/google-ads${queryString}`).then((r) => r.json() as Promise<PlatformResponse>),
        fetch(`${baseUrl}/api/data/meta-ads${queryString}`).then((r) => r.json() as Promise<PlatformResponse>),
        fetch(`${baseUrl}/api/data/criteo${queryString}`).then((r) => r.json() as Promise<PlatformResponse>),
        fetch(`${baseUrl}/api/data/baselinker${queryString}`).then((r) => r.json() as Promise<PlatformResponse>),
      ]);

    const ga4 = ga4Res.status === 'fulfilled' ? ga4Res.value.data : null;
    const gads = gadsRes.status === 'fulfilled' ? gadsRes.value.data : null;
    const meta = metaRes.status === 'fulfilled' ? metaRes.value.data : null;
    const criteo = criteoRes.status === 'fulfilled' ? criteoRes.value.data : null;
    const baselinker = baselinkerRes.status === 'fulfilled' ? baselinkerRes.value.data : null;

    // Extract sessions from GA4
    const ga4Data = ga4 as Record<string, unknown> | null;
    const sessionsObj = ga4Data?.sessions as { rows: Record<string, unknown>[] } | undefined;
    const sessionsRows = sessionsObj?.rows ?? [];
    const totalSessions = sessionsRows.reduce(
      (sum: number, r: Record<string, unknown>) => sum + Number(r.sessions ?? 0),
      0,
    );

    // Revenue from BaseLinker (primary source) or estimate from ad platforms
    const blData = baselinker as Record<string, unknown> | null;
    const blRevenue = Number(blData?.revenue ?? 0);

    // If BaseLinker has revenue data, use it; otherwise aggregate from ad platform conversion values
    const gadsData = gads as Record<string, unknown> | null;
    const metaData = meta as Record<string, unknown> | null;
    const criteoData = criteo as Record<string, unknown> | null;

    const gadsConvValue = Number(gadsData?.totalConversionValue ?? 0);
    const metaRevenue = Number(metaData?.revenue ?? 0);
    // Criteo doesn't provide direct revenue, estimate from spend * roas
    const criteoSpend = Number(criteoData?.totalSpend ?? 0);
    const criteoRoas = Number(criteoData?.roas ?? 0);
    const criteoEstRevenue = criteoSpend * criteoRoas;

    const revenue = blRevenue > 0
      ? blRevenue
      : gadsConvValue + metaRevenue + criteoEstRevenue;

    // Transactions and AOV from BaseLinker
    const transactions = Number(blData?.orderCount ?? 0);
    const aov = transactions > 0 ? revenue / transactions : 0;
    const cr = totalSessions > 0 ? (transactions / totalSessions) * 100 : 0;

    // Ad spend by platform
    const gadsSpend = Number(gadsData?.totalSpend ?? 0);
    const metaSpend = Number(metaData?.totalSpend ?? 0);
    const criteoSpendVal = Number(criteoData?.totalSpend ?? 0);
    const totalSpend = gadsSpend + metaSpend + criteoSpendVal;

    // COS (Cost of Sale) = totalSpend / revenue * 100
    const costShare = revenue > 0 ? (totalSpend / revenue) * 100 : 0;

    const platformSpend = [
      {
        platform: 'google-ads',
        spend: Math.round(gadsSpend * 100) / 100,
        spendShare: totalSpend > 0 ? (gadsSpend / totalSpend) * 100 : 0,
      },
      {
        platform: 'meta-ads',
        spend: Math.round(metaSpend * 100) / 100,
        spendShare: totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0,
      },
      {
        platform: 'criteo',
        spend: Math.round(criteoSpendVal * 100) / 100,
        spendShare: totalSpend > 0 ? (criteoSpendVal / totalSpend) * 100 : 0,
      },
    ];

    // Track errors from each platform
    const errors: Record<string, string | null> = {
      baselinker: baselinkerRes.status === 'rejected' ? String(baselinkerRes.reason) : null,
      ga4: ga4Res.status === 'rejected' ? String(ga4Res.reason) : null,
      googleAds: gadsRes.status === 'rejected' ? String(gadsRes.reason) : null,
      metaAds: metaRes.status === 'rejected' ? String(metaRes.reason) : null,
      criteo: criteoRes.status === 'rejected' ? String(criteoRes.reason) : null,
    };

    const data = {
      revenue: {
        label: 'Przychód (SHR)',
        value: Math.round(revenue * 100) / 100,
        format: 'currency',
      },
      aov: {
        label: 'AOV',
        value: Math.round(aov * 100) / 100,
        format: 'currency',
      },
      cr: {
        label: 'CR',
        value: Math.round(cr * 100) / 100,
        format: 'percent',
      },
      transactions: {
        label: 'Transakcje',
        value: transactions,
        format: 'number',
      },
      sessions: {
        label: 'Sesje',
        value: totalSessions,
        format: 'number',
      },
      marketing: {
        totalSpend: {
          label: 'Wydatki reklamowe',
          value: Math.round(totalSpend * 100) / 100,
          format: 'currency',
        },
        costShare: {
          label: 'COS (Cost of Sale)',
          value: Math.round(costShare * 100) / 100,
          format: 'percent',
        },
      },
      platformSpend,
      alerts: [],
      errors,
    };

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Executive summary error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Executive summary fetch failed' },
      { status: 500 },
    );
  }
}
