import { type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), '.dashboard-config.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'room99admin';

function readConfig(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function writeConfig(config: Record<string, string>) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const password = params.get('password');

  if (password !== ADMIN_PASSWORD) {
    return Response.json({ error: 'Nieprawidlowe haslo' }, { status: 401 });
  }

  const config = readConfig();
  // Mask keys for display
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    masked[key] = value ? `${value.slice(0, 12)}...${value.slice(-4)}` : '';
  }

  return Response.json({ config: masked });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, settings } = body;

    if (password !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Nieprawidlowe haslo' }, { status: 401 });
    }

    if (!settings || typeof settings !== 'object') {
      return Response.json({ error: 'Brak ustawien' }, { status: 400 });
    }

    const config = readConfig();

    // Only update non-empty values
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string' && value.trim()) {
        config[key] = value.trim();
      }
    }

    writeConfig(config);

    return Response.json({ success: true, message: 'Ustawienia zapisane. Zrestartuj serwer aby zastosowac zmiany.' });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Blad zapisu ustawien' },
      { status: 500 }
    );
  }
}
