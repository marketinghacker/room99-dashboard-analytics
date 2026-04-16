import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { initDb, saveData } from '@/lib/db';
import { toGoogleAdsDateRange, toMetaDatePreset } from '@/lib/date-utils';
import { format, subDays, startOfMonth } from 'date-fns';

const GA4_PROPERTY = '315856757';
const GADS_CUSTOMER = '1331139339';
const META_ACCOUNT = 'act_295812916';
const CRITEO_ADVERTISER = '55483';

/** Periods to sync: this_month and last_30_days */
function getPeriodsToSync(): Array<{ key: string; start: string; end: string }> {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const d30 = format(subDays(now, 30), 'yyyy-MM-dd');
  const d7 = format(subDays(now, 7), 'yyyy-MM-dd');
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');

  return [
    { key: `${monthStart}_${today}`, start: monthStart, end: today },
    { key: `${d30}_${yesterday}`, start: d30, end: yesterday },
    { key: `${d7}_${yesterday}`, start: d7, end: yesterday },
  ];
}

async function fetchGA4(start: string, end: string) {
  // Sequential to avoid API rate limits
  let sessionsData = null;
  let trafficData = null;

  try {
    sessionsData = await callMcpTool('ga4', `Call the run_report tool with these exact parameters:
- property_id: "${GA4_PROPERTY}"
- start_date: "${start}"
- end_date: "${end}"
- metrics: ["sessions", "totalUsers", "newUsers", "engagementRate", "screenPageViews"]
- dimensions: ["date"]
Return ONLY the raw tool output as JSON.`);
  } catch (e) { console.error('GA4 sessions error:', e); }

  try {
    trafficData = await callMcpTool('ga4', `Call the get_traffic_sources tool with these exact parameters:
- property_id: "${GA4_PROPERTY}"
- start_date: "${start}"
- end_date: "${end}"
- dimensions: ["sessionDefaultChannelGroup"]
Return ONLY the raw tool output as JSON.`);
  } catch (e) { console.error('GA4 traffic error:', e); }

  return { sessions: sessionsData, traffic: trafficData };
}

async function fetchGoogleAds(start: string, end: string) {
  const dateRange = toGoogleAdsDateRange({ start, end });
  const raw = await callMcpTool('google-ads', `Call the get_campaigns tool with these exact parameters:
- customer_id: "${GADS_CUSTOMER}"
- date_range: "${dateRange}"
Return ONLY the raw tool output as JSON.`);

  const campaigns = Array.isArray(raw) ? raw : [];
  let totalSpend = 0, totalConv = 0, totalConvValue = 0;

  const parsed = campaigns.map((c: Record<string, unknown>) => {
    const micros = Number(c.metrics_cost_micros ?? 0);
    const spend = micros > 100000 ? micros / 1_000_000 : Number(c.spend ?? micros);
    const conv = Number(c.metrics_conversions ?? 0);
    const convVal = Number(c.metrics_conversions_value ?? 0);
    totalSpend += spend;
    totalConv += conv;
    totalConvValue += convVal;

    const chType = Number(c.campaign_advertising_channel_type ?? 0);
    const type = chType === 2 ? 'Search' : chType === 4 ? 'Shopping' : chType === 10 ? 'PMax' : 'Other';

    return {
      name: String(c.campaign_name ?? 'Unknown'),
      type,
      spend: Math.round(spend * 100) / 100,
      conversions: Math.round(conv * 100) / 100,
      convValue: Math.round(convVal * 100) / 100,
      clicks: Number(c.metrics_clicks ?? 0),
      impressions: Number(c.metrics_impressions ?? 0),
    };
  });

  parsed.sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend);

  return {
    campaigns: parsed,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalConversions: Math.round(totalConv * 100) / 100,
    totalConversionValue: Math.round(totalConvValue * 100) / 100,
    roas: totalSpend > 0 ? Math.round((totalConvValue / totalSpend) * 100) / 100 : 0,
  };
}

async function fetchMeta(start: string, end: string) {
  const datePreset = toMetaDatePreset({ start, end });
  const raw = await callMcpTool('meta-ads', `Call the get_account_insights tool with these exact parameters:
- account_id: "${META_ACCOUNT}"
- date_preset: "${datePreset}"
Return ONLY the raw tool output as JSON.`) as Record<string, unknown>;

  const insights = (raw.insights ?? raw.data ?? [raw]) as Array<Record<string, unknown>>;
  const insight = (Array.isArray(insights) ? insights[0] : raw) as Record<string, unknown>;

  const spend = Number(insight?.spend ?? 0);
  const impressions = Number(insight?.impressions ?? 0);
  const clicks = Number(insight?.clicks ?? 0);

  // Parse actions (can be object or array)
  let conversions = 0, revenue = 0;
  const actions = insight?.actions;
  if (actions && typeof actions === 'object' && !Array.isArray(actions)) {
    conversions = Number((actions as Record<string, unknown>).purchase ?? 0);
  }
  const avRaw = insight?.action_values;
  if (avRaw && typeof avRaw === 'object' && !Array.isArray(avRaw)) {
    revenue = Number((avRaw as Record<string, unknown>).purchase ?? 0);
  }

  return {
    totalSpend: Math.round(spend * 100) / 100,
    impressions, clicks,
    ctr: Number(insight?.ctr ?? 0),
    cpc: Number(insight?.cpc ?? 0),
    conversions, revenue: Math.round(revenue * 100) / 100,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
  };
}

async function fetchCriteo(start: string, end: string) {
  const raw = await callMcpTool('criteo', `Call the get_campaign_stats tool with these exact parameters:
- advertiser_ids: ["${CRITEO_ADVERTISER}"]
- metrics: ["Clicks", "Displays", "AdvertiserCost", "RoasAllPc30d"]
- dimensions: ["CampaignId"]
- currency: "PLN"
- start_date: "${start}"
- end_date: "${end}"
Return ONLY the raw tool output as JSON.`) as Record<string, unknown>;

  const stats = (raw.stats ?? raw) as Record<string, unknown>;
  const rows = (stats.Rows ?? stats.rows ?? []) as Array<Record<string, unknown>>;

  let totalSpend = 0, totalClicks = 0, totalDisplays = 0;
  const campaigns = rows.map((r) => {
    const spend = Number(r.AdvertiserCost ?? 0);
    const clicks = Number(r.Clicks ?? 0);
    const displays = Number(r.Displays ?? 0);
    totalSpend += spend;
    totalClicks += clicks;
    totalDisplays += displays;
    return {
      id: String(r.CampaignId ?? ''),
      name: String(r.Campaign ?? r.CampaignId ?? ''),
      spend: Math.round(spend * 100) / 100,
      clicks, displays,
      roas: Number(r.RoasAllPc30d ?? 0),
    };
  });

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    clicks: totalClicks, displays: totalDisplays,
    roas: totalSpend > 0 ? campaigns.reduce((s, c) => s + c.spend * c.roas, 0) / totalSpend : 0,
    campaigns,
  };
}

export async function GET(request: NextRequest) {
  // Verify cron secret (optional, for security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initDb();
    const periods = getPeriodsToSync();
    const results: Record<string, unknown> = {};

    // Only sync the first period (this_month) to avoid rate limits
    // Cron runs every 30 min so it will catch up
    const period = periods[0];
    {
      const platformResults: Record<string, string> = {};

      // Fetch SEQUENTIALLY to avoid Anthropic API rate limits (500 errors on parallel)
      const ga4 = await fetchGA4(period.start, period.end).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e }));
      const gads = await fetchGoogleAds(period.start, period.end).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e }));
      const meta = await fetchMeta(period.start, period.end).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e }));
      const criteo = await fetchCriteo(period.start, period.end).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e }));

      if (ga4.status === 'fulfilled') {
        await saveData('ga4', period.key, ga4.value);
        platformResults.ga4 = 'ok';
      } else { platformResults.ga4 = String(ga4.reason); }

      if (gads.status === 'fulfilled') {
        await saveData('google-ads', period.key, gads.value);
        platformResults.googleAds = 'ok';
      } else { platformResults.googleAds = String(gads.reason); }

      if (meta.status === 'fulfilled') {
        await saveData('meta-ads', period.key, meta.value);
        platformResults.meta = 'ok';
      } else { platformResults.meta = String(meta.reason); }

      if (criteo.status === 'fulfilled') {
        await saveData('criteo', period.key, criteo.value);
        platformResults.criteo = 'ok';
      } else { platformResults.criteo = String(criteo.reason); }

      // Build executive summary from fetched data
      const gadsData = gads.status === 'fulfilled' ? gads.value : null;
      const metaData = meta.status === 'fulfilled' ? meta.value : null;
      const criteoData = criteo.status === 'fulfilled' ? criteo.value : null;
      const ga4Data = ga4.status === 'fulfilled' ? ga4.value : null;

      const gSpend = gadsData?.totalSpend ?? 0;
      const mSpend = metaData?.totalSpend ?? 0;
      const cSpend = criteoData?.totalSpend ?? 0;
      const totalSpend = gSpend + mSpend + cSpend;

      // Sessions from GA4
      let totalSessions = 0;
      if (ga4Data?.sessions) {
        const raw = ga4Data.sessions as Record<string, unknown>;
        const rows = raw.rows as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const mets = row.metricValues as Array<{ value: string }> | undefined;
            totalSessions += mets?.[0] ? Number(mets[0].value) : Number(row.sessions ?? 0);
          }
        }
      }

      const summary = {
        sessions: totalSessions,
        totalSpend: Math.round(totalSpend * 100) / 100,
        gadsSpend: Math.round(gSpend * 100) / 100,
        metaSpend: Math.round(mSpend * 100) / 100,
        criteoSpend: Math.round(cSpend * 100) / 100,
      };
      await saveData('executive-summary', period.key, summary);

      results[period.key] = platformResults;
    }

    return Response.json({ success: true, period: period.key, results, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
