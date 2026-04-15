import { type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const LIVE_DATA_PATH = path.join(process.cwd(), 'data', 'live-executive-summary.json');

export async function GET(request: NextRequest) {
  try {
    if (fs.existsSync(LIVE_DATA_PATH)) {
      const data = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, 'utf-8'));
      return Response.json({ data, lastUpdated: new Date().toISOString(), cached: false });
    }
    return Response.json({ error: 'Brak danych. Uruchom odswiezanie danych przez Claude Code.' }, { status: 503 });
  } catch (error) {
    console.error('Executive summary error:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Blad odczytu danych' }, { status: 500 });
  }
}
