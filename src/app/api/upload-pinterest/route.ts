import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'room99admin';
const DATA_PATH = path.join(process.cwd(), 'data', 'pinterest-ads.json');

interface PinterestRow {
  [key: string]: string;
}

interface PinterestCampaign {
  name: string;
  id: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  revenue: number;
  roas: number;
}

const REQUIRED_COLUMNS = ['Campaign Name', 'Spend', 'Impressions', 'Clicks'];

export async function GET() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      const data = JSON.parse(raw);
      return NextResponse.json({
        uploadedAt: data.uploadedAt || null,
        campaignCount: data.campaigns?.length || 0,
      });
    }
    return NextResponse.json({
      uploadedAt: null,
      campaignCount: 0,
    });
  } catch {
    return NextResponse.json({
      uploadedAt: null,
      campaignCount: 0,
    });
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const adminPassword = request.headers.get('x-admin-password');
  if (adminPassword !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'Nieautoryzowany dostep. Nieprawidlowe haslo.' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nie przeslano pliku.' },
        { status: 400 }
      );
    }

    const text = await file.text();

    // Parse CSV with PapaParse
    const parseResult = Papa.parse<PinterestRow>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: `Blad parsowania CSV: ${parseResult.errors[0].message}` },
        { status: 400 }
      );
    }

    const rows = parseResult.data;
    const headers = parseResult.meta.fields || [];

    // Validate required columns
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Brakujace wymagane kolumny: ${missingColumns.join(', ')}` },
        { status: 400 }
      );
    }

    // Transform to pinterest-ads.json structure
    const campaigns: PinterestCampaign[] = rows.map((row, idx) => {
      const spend = parseFloat(row['Spend']?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0');
      const impressions = parseInt(row['Impressions']?.replace(/[^0-9]/g, '') || '0', 10);
      const clicks = parseInt(row['Clicks']?.replace(/[^0-9]/g, '') || '0', 10);
      const conversions = parseInt(row['Conversions']?.replace(/[^0-9]/g, '') || '0', 10);
      const revenue = parseFloat(row['Revenue']?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0');
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      return {
        name: row['Campaign Name'] || `Campaign ${idx + 1}`,
        id: row['Campaign ID'] || `pinterest_${idx + 1}`,
        status: row['Status'] || 'ACTIVE',
        spend,
        impressions,
        clicks,
        ctr: Math.round(ctr * 100) / 100,
        conversions,
        revenue,
        roas: Math.round(roas * 100) / 100,
      };
    });

    // Calculate KPIs
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

    const pinterestData = {
      uploadedAt: new Date().toISOString(),
      period: {
        label: 'Pinterest Import',
        source: file.name,
      },
      kpis: {
        spend: { label: 'Wydatki', value: totalSpend, format: 'currency' },
        revenue: { label: 'Przychod', value: totalRevenue, format: 'currency' },
        roas: { label: 'ROAS', value: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0, format: 'decimal' },
        impressions: { label: 'Wyswietlenia', value: totalImpressions, format: 'number' },
        clicks: { label: 'Klikniecia', value: totalClicks, format: 'number' },
        ctr: { label: 'CTR', value: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0, format: 'pp' },
        conversions: { label: 'Konwersje', value: totalConversions, format: 'number' },
        cr: { label: 'CR', value: totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 10000) / 100 : 0, format: 'pp' },
      },
      campaigns,
    };

    // Write to file
    fs.writeFileSync(DATA_PATH, JSON.stringify(pinterestData, null, 2), 'utf-8');

    return NextResponse.json({
      message: `Pomyslnie zaimportowano ${campaigns.length} kampanii Pinterest.`,
      campaignCount: campaigns.length,
    });
  } catch (error) {
    console.error('Pinterest upload error:', error);
    return NextResponse.json(
      { error: 'Wewnetrzny blad serwera podczas przetwarzania pliku.' },
      { status: 500 }
    );
  }
}
