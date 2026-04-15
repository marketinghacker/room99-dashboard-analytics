import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';
import { toGoogleAdsDateRange } from '@/lib/date-utils';

const CUSTOMER_ID = '1331139339';

/** Map Google Ads campaign type enum values to human labels */
function mapChannelType(typeValue: unknown): string {
  const num = Number(typeValue);
  switch (num) {
    case 2:
      return 'Search';
    case 4:
      return 'Shopping';
    case 10:
      return 'PMax';
    default: {
      // Also handle string labels that the API might return
      const s = String(typeValue ?? '').toUpperCase();
      if (s.includes('SEARCH')) return 'Search';
      if (s.includes('SHOPPING')) return 'Shopping';
      if (s.includes('PERFORMANCE_MAX') || s.includes('PMAX')) return 'PMax';
      return String(typeValue ?? 'Other');
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('google-ads', { start, end });

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
    const dateRange = start && end
      ? toGoogleAdsDateRange({ start, end })
      : 'THIS_MONTH';

    const raw = await callMcpTool(
      'google-ads',
      `Call the get_campaigns tool with these exact parameters:
- customer_id: "${CUSTOMER_ID}"
- date_range: "${dateRange}"
Return ONLY the raw tool output as JSON.`,
    );

    // Parse the response — can be an array directly or wrapped in an object
    const campaignsRaw = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>).campaigns ?? (raw as Record<string, unknown>).data ?? []) as Record<string, unknown>[];

    let campaigns: Record<string, unknown>[] = [];
    let totalSpend = 0;
    let totalConversions = 0;
    let totalConversionValue = 0;

    if (Array.isArray(campaignsRaw)) {
      campaigns = campaignsRaw.map((c: Record<string, unknown>) => {
        // Handle cost_micros (divide by 1_000_000) or already-converted cost
        const costMicros = Number(c.metrics_cost_micros ?? c.cost_micros ?? 0);
        const spend = costMicros > 100_000
          ? costMicros / 1_000_000
          : Number(c.spend ?? c.cost ?? c.metrics_cost ?? costMicros);
        const conversions = Number(c.metrics_conversions ?? c.conversions ?? 0);
        const convValue = Number(
          c.metrics_conversions_value ?? c.conversions_value ?? c.conversion_value ?? 0,
        );
        const name = String(
          c.campaign_name ?? c.name ?? c.campaign ?? 'Unknown',
        );
        const channelType = c.campaign_advertising_channel_type ?? c.advertising_channel_type ?? c.type ?? '';

        totalSpend += spend;
        totalConversions += conversions;
        totalConversionValue += convValue;

        return {
          name,
          type: mapChannelType(channelType),
          spend: Math.round(spend * 100) / 100,
          conversions: Math.round(conversions * 100) / 100,
          convValue: Math.round(convValue * 100) / 100,
          clicks: Number(c.metrics_clicks ?? c.clicks ?? 0),
          impressions: Number(c.metrics_impressions ?? c.impressions ?? 0),
        };
      });

      // Sort by spend descending
      campaigns.sort((a, b) => Number(b.spend) - Number(a.spend));
    }

    const roas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;

    const data = {
      campaigns,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalConversions: Math.round(totalConversions * 100) / 100,
      totalConversionValue: Math.round(totalConversionValue * 100) / 100,
      roas: Math.round(roas * 100) / 100,
    };

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Google Ads MCP error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Google Ads data fetch failed' },
      { status: 500 },
    );
  }
}
