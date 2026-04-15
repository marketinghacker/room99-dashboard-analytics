import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';
import { toMetaDatePreset } from '@/lib/date-utils';

const ACCOUNT_ID = 'act_295812916';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('meta-ads', { start, end });

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
    const datePreset = start && end
      ? toMetaDatePreset({ start, end })
      : 'this_month';

    const raw = await callMcpTool(
      'meta-ads',
      `Call the get_account_insights tool with these exact parameters:
- account_id: "${ACCOUNT_ID}"
- date_preset: "${datePreset}"
Return ONLY the raw tool output as JSON.`,
    );

    // Parse the Meta Ads response — format: { insights: [{...}] } or { data: [{...}] }
    const rawObj = raw as Record<string, unknown>;
    const insightsArray = (rawObj.insights ?? rawObj.data ?? [rawObj]) as Array<Record<string, unknown>>;
    const insight = (Array.isArray(insightsArray) ? insightsArray[0] : rawObj) as Record<string, unknown> ?? {};

    const spend = Number(insight.spend ?? 0);
    const impressions = Number(insight.impressions ?? 0);
    const clicks = Number(insight.clicks ?? 0);
    const ctr = Number(insight.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0));
    const cpc = Number(insight.cpc ?? (clicks > 0 ? spend / clicks : 0));

    // Extract purchase conversions — actions can be object {type: count} or array [{action_type, value}]
    let conversions = 0;
    let revenue = 0;

    const actionsRaw = insight.actions;
    if (actionsRaw && typeof actionsRaw === 'object' && !Array.isArray(actionsRaw)) {
      // Object format: { purchase: 159, ... }
      const actObj = actionsRaw as Record<string, unknown>;
      conversions = Number(actObj.purchase ?? actObj['offsite_conversion.fb_pixel_purchase'] ?? 0);
    } else if (Array.isArray(actionsRaw)) {
      for (const action of actionsRaw) {
        const a = action as Record<string, unknown>;
        if (String(a.action_type) === 'purchase') conversions += Number(a.value ?? 0);
      }
    }

    const avRaw = insight.action_values;
    if (avRaw && typeof avRaw === 'object' && !Array.isArray(avRaw)) {
      const avObj = avRaw as Record<string, unknown>;
      revenue = Number(avObj.purchase ?? avObj['offsite_conversion.fb_pixel_purchase'] ?? 0);
    } else if (Array.isArray(avRaw)) {
      for (const av of avRaw) {
        const a = av as Record<string, unknown>;
        if (String(a.action_type) === 'purchase') revenue += Number(a.value ?? 0);
      }
    }

    const roas = spend > 0 ? revenue / spend : 0;

    const data = {
      totalSpend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      conversions: Math.round(conversions),
      revenue: Math.round(revenue * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      campaigns: null,
    };

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Meta Ads MCP error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Meta Ads data fetch failed' },
      { status: 500 },
    );
  }
}
