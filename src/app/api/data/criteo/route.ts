import { type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const LIVE_DATA_PATH = path.join(process.cwd(), 'data', 'live-criteo.json');

export async function GET(request: NextRequest) {
  try {
    if (fs.existsSync(LIVE_DATA_PATH)) {
      const data = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, 'utf-8'));
      return Response.json({ data, lastUpdated: new Date().toISOString(), cached: false });
    }
    return Response.json({ error: 'Brak danych Criteo.' }, { status: 503 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Blad' }, { status: 500 });
  }
}
