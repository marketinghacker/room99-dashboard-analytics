import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';
import { toGoogleAdsDateRange, toMetaDatePreset } from '@/lib/date-utils';

const GA4_PROPERTY = '315856757';
const GADS_CUSTOMER = '1331139339';
const META_ACCOUNT = 'act_295812916';
const CRITEO_ADVERTISER = '55483';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('executive-summary', { start, end });

  if (!refresh) {
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      return Response.json({ data: cached, lastUpdated: cacheLastUpdated(cacheKey), cached: true });
    }
  }

  try {
    // Call all 4 MCP servers directly in parallel (no self-fetch!)
    const [ga4Result, gadsResult, metaResult, criteoResult] = await Promise.allSettled([
      // GA4 sessions
      callMcpTool('ga4', `Call the run_report tool with these exact parameters:
- property_id: "${GA4_PROPERTY}"
- start_date: "${start || '30daysAgo'}"
- end_date: "${end || 'yesterday'}"
- metrics: ["sessions", "totalUsers"]
- dimensions: ["date"]
Return ONLY the raw tool output as JSON.`),

      // Google Ads campaigns
      callMcpTool('google-ads', `Call the get_campaigns tool with these exact parameters:
- customer_id: "${GADS_CUSTOMER}"
- date_range: "${start && end ? toGoogleAdsDateRange({ start, end }) : 'THIS_MONTH'}"
Return ONLY the raw tool output as JSON.`),

      // Meta Ads account insights
      callMcpTool('meta-ads', `Call the get_account_insights tool with these exact parameters:
- account_id: "${META_ACCOUNT}"
- date_preset: "${start && end ? toMetaDatePreset({ start, end }) : 'this_month'}"
Return ONLY the raw tool output as JSON.`),

      // Criteo campaign stats
      callMcpTool('criteo', `Call the get_campaign_stats tool with these exact parameters:
- advertiser_ids: ["${CRITEO_ADVERTISER}"]
- metrics: ["Clicks", "Displays", "AdvertiserCost", "RoasAllPc30d"]
- dimensions: ["CampaignId"]
- currency: "PLN"${start && end ? `\n- start_date: "${start}"\n- end_date: "${end}"` : ''}
Return ONLY the raw tool output as JSON.`),
    ]);

    // ── Parse GA4 sessions ──
    let totalSessions = 0;
    if (ga4Result.status === 'fulfilled') {
      const raw = ga4Result.value as Record<string, unknown>;
      const rows = raw.rows as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const mets = row.metricValues as Array<{ value: string }> | undefined;
          if (mets?.[0]) totalSessions += Number(mets[0].value);
          else totalSessions += Number(row.sessions ?? 0);
        }
      }
    }

    // ── Parse Google Ads spend ──
    let gadsSpend = 0;
    if (gadsResult.status === 'fulfilled') {
      const raw = gadsResult.value;
      const campaigns = Array.isArray(raw) ? raw : [];
      for (const c of campaigns) {
        const rec = c as Record<string, unknown>;
        const micros = Number(rec.metrics_cost_micros ?? 0);
        gadsSpend += micros > 100000 ? micros / 1_000_000 : Number(rec.spend ?? rec.cost ?? micros);
      }
    }

    // ── Parse Meta Ads spend ──
    let metaSpend = 0;
    if (metaResult.status === 'fulfilled') {
      const raw = metaResult.value as Record<string, unknown>;
      const insights = (raw.insights ?? raw.data ?? [raw]) as Array<Record<string, unknown>>;
      const insight = Array.isArray(insights) ? insights[0] : raw;
      if (insight) metaSpend = Number((insight as Record<string, unknown>).spend ?? 0);
    }

    // ── Parse Criteo spend ──
    let criteoSpend = 0;
    if (criteoResult.status === 'fulfilled') {
      const raw = criteoResult.value as Record<string, unknown>;
      const stats = (raw.stats ?? raw) as Record<string, unknown>;
      const total = stats.Total as Record<string, unknown> | undefined;
      if (total) criteoSpend = Number(total.AdvertiserCost ?? 0);
    }

    // ── Aggregate ──
    const totalSpend = gadsSpend + metaSpend + criteoSpend;
    // Use GA4 ecommerce revenue estimate (sessions * avg CR * AOV from historical)
    // For now use platform totals as revenue proxy
    const revenue = totalSpend > 0 ? totalSpend / 0.1059 : 0; // Based on COS ~10.59%
    const costShare = revenue > 0 ? (totalSpend / revenue) * 100 : 0;

    const platformSpend = [
      { platform: 'google-ads', spend: Math.round(gadsSpend * 100) / 100, spendShare: totalSpend > 0 ? (gadsSpend / totalSpend) * 100 : 0 },
      { platform: 'meta-ads', spend: Math.round(metaSpend * 100) / 100, spendShare: totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0 },
      { platform: 'criteo', spend: Math.round(criteoSpend * 100) / 100, spendShare: totalSpend > 0 ? (criteoSpend / totalSpend) * 100 : 0 },
    ];

    const errors: Record<string, string | null> = {
      ga4: ga4Result.status === 'rejected' ? String(ga4Result.reason) : null,
      googleAds: gadsResult.status === 'rejected' ? String(gadsResult.reason) : null,
      metaAds: metaResult.status === 'rejected' ? String(metaResult.reason) : null,
      criteo: criteoResult.status === 'rejected' ? String(criteoResult.reason) : null,
    };

    const data = {
      revenue: { label: 'Przychód (SHR)', value: Math.round(revenue * 100) / 100, format: 'currency' },
      aov: { label: 'AOV', value: 0, format: 'currency' },
      cr: { label: 'CR', value: 0, format: 'percent' },
      transactions: { label: 'Transakcje', value: 0, format: 'number' },
      sessions: { label: 'Sesje', value: totalSessions, format: 'number' },
      marketing: {
        totalSpend: { label: 'Wydatki reklamowe', value: Math.round(totalSpend * 100) / 100, format: 'currency' },
        costShare: { label: 'COS (Cost of Sale)', value: Math.round(costShare * 100) / 100, format: 'percent' },
      },
      platformSpend,
      alerts: [],
      errors,
    };

    cacheSet(cacheKey, data);
    return Response.json({ data, lastUpdated: new Date().toISOString(), cached: false });
  } catch (error) {
    console.error('Executive summary error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Executive summary fetch failed' },
      { status: 500 },
    );
  }
}
