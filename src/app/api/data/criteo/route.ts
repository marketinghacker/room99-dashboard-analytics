import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';

const ADVERTISER_ID = '55483';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('criteo', { start, end });

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
    const dateParams = start && end
      ? `\n- start_date: "${start}"\n- end_date: "${end}"`
      : '';

    const raw = await callMcpTool(
      'criteo',
      `Call the get_campaign_stats tool with these exact parameters:
- advertiser_ids: ["${ADVERTISER_ID}"]
- metrics: ["Clicks", "Displays", "AdvertiserCost", "RoasAllPc30d"]
- dimensions: ["CampaignId"]
- currency: "PLN"${dateParams}

Do NOT add any extra parameters. Call the tool immediately.`,
    );

    // Parse the Criteo stats response — format: { stats: { Total: {...}, Rows: [...] } }
    const rawObj = raw as Record<string, unknown>;
    const stats = (rawObj.stats ?? rawObj) as Record<string, unknown>;
    const statsRows = (stats.Rows ?? stats.rows ?? rawObj.Rows ?? rawObj.rows ?? rawObj.data ?? []) as Record<string, unknown>[];

    let campaigns: Record<string, unknown>[] = [];
    let totalSpend = 0;
    let totalClicks = 0;
    let totalDisplays = 0;

    if (Array.isArray(statsRows)) {
      campaigns = statsRows.map((row: Record<string, unknown>) => {
        const spend = Number(row.AdvertiserCost ?? row.advertiserCost ?? row.cost ?? 0);
        const clicks = Number(row.Clicks ?? row.clicks ?? 0);
        const displays = Number(row.Displays ?? row.displays ?? row.impressions ?? 0);
        const roas = Number(row.RoasAllPc30d ?? row.roas ?? 0);
        const id = String(row.CampaignId ?? row.campaignId ?? row.campaign_id ?? '');
        const name = String(row.Campaign ?? row.CampaignName ?? row.campaignName ?? row.campaign_name ?? row.name ?? id);

        totalSpend += spend;
        totalClicks += clicks;
        totalDisplays += displays;

        return {
          id,
          name,
          spend: Math.round(spend * 100) / 100,
          clicks,
          displays,
          roas: Math.round(roas * 100) / 100,
        };
      });

      // Sort by spend descending
      campaigns.sort((a, b) => Number(b.spend) - Number(a.spend));
    }

    const overallRoas = totalSpend > 0
      ? campaigns.reduce((sum, c) => sum + Number(c.spend) * Number(c.roas), 0) / totalSpend
      : 0;

    const data = {
      totalSpend: Math.round(totalSpend * 100) / 100,
      clicks: totalClicks,
      displays: totalDisplays,
      roas: Math.round(overallRoas * 100) / 100,
      campaigns,
    };

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Criteo MCP error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Criteo data fetch failed' },
      { status: 500 },
    );
  }
}
