import { type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const LIVE_DATA_PATH = path.join(process.cwd(), 'data', 'live-baselinker.json');

export async function GET(request: NextRequest) {
  try {
    if (fs.existsSync(LIVE_DATA_PATH)) {
      const data = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, 'utf-8'));
      return Response.json({ data, lastUpdated: new Date().toISOString(), cached: false });
    }
    return Response.json({ data: { revenue: 0, orderCount: 0, aov: 0, products: [], categoryAggregates: [] }, lastUpdated: new Date().toISOString(), cached: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Blad' }, { status: 500 });
  }
}
