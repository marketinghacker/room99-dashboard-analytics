# Dashboard v2 Holistic Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Zamknąć 8 bugów dokładności + dodać per-kategoria/kolekcja analitykę z YoY + real-time pipeline (BaseLinker webhooki + SSE) + custom date range picker.

**Architecture:** Jeden source-of-truth per metryka (BaseLinker direct / Facebook Graph / GAQL / GA4 eventCount / Windsor). Zero aggregate-spread'ów. Real-time przez webhooki + SSE push. Cache invalidation per-date. Custom range bypassuje cache i idzie direct z daily tables.

**Tech Stack:** Next.js 16, TypeScript strict, Drizzle ORM, Postgres (Railway), Facebook Graph API SDK, SSE (native), react-day-picker, zod.

**Reference design:** `docs/plans/2026-04-17-dashboard-v2-holistic-fix-design.md` (approved).

---

## Phase 0 — Quick wins (deployable dziś)

### Task 0.1: Cron co 5 min zamiast 30

**Files:**
- Modify: `/tmp/cron-sync/railway.json` (nowa kopia na Railway service)

**Step 1:** Update cron schedule

Railway CLI:
```bash
cd /tmp/cron-sync
cat > railway.json <<'EOF'
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "cronSchedule": "*/5 * * * *",
    "restartPolicyType": "NEVER"
  }
}
EOF
railway link -p defafc8d-d33f-4bde-93b9-3f9dc8eafa81 -e production -s cron-sync
railway up --detach
```

**Step 2:** Verify

```bash
railway logs --service cron-sync 2>&1 | tail -10
```
Expected: next firing within 5 min.

**Step 3:** Commit

```bash
git add docs/plans/2026-04-17-dashboard-v2-holistic-fix.md
git commit -m "ops: cron 30min → 5min for near-real-time"
```

---

### Task 0.2: SWR refresh interval 30s

**Files:**
- Modify: `src/components/providers.tsx`

**Step 1:** Update SWRConfig

Find:
```tsx
<SWRConfig value={{
  fetcher,
  revalidateOnFocus: true,
  dedupingInterval: 30_000,
  errorRetryCount: 2,
  errorRetryInterval: 1500,
}}>
```

Change to:
```tsx
<SWRConfig value={{
  fetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 30_000, // poll every 30s while tab is visible
  refreshWhenHidden: false,
  dedupingInterval: 10_000,
  errorRetryCount: 2,
  errorRetryInterval: 1500,
}}>
```

**Step 2:** Build + push

```bash
pnpm build && git add src/components/providers.tsx && git commit -m "feat(ui): SWR auto-refresh every 30s" && git push
```

---

### Task 0.3: Cache invalidation per-date (incremental rollup)

**Files:**
- Modify: `src/lib/rollup.ts` — add `buildRollups({ onlyDates?: string[] })` option
- Test: `src/lib/rollup.test.ts` — new test

**Step 1: Write failing test**

```ts
// src/lib/rollup.test.ts
import { describe, it, expect, vi } from 'vitest';
import { affectedPeriods } from './rollup';

describe('affectedPeriods', () => {
  it('returns only periods containing given dates', () => {
    const today = new Date('2026-04-17T12:00:00Z');
    const result = affectedPeriods(['2026-04-15'], today);
    // last_7d covers 2026-04-10..16 → includes 15
    // this_month covers 2026-04-01..17 → includes 15
    // yesterday=2026-04-16 → doesn't include 15
    expect(result).toContain('last_7d');
    expect(result).toContain('this_month');
    expect(result).not.toContain('yesterday');
  });
});
```

**Step 2: Run failing**

```bash
pnpm test src/lib/rollup.test.ts --run
```
Expected: FAIL (affectedPeriods not exported)

**Step 3: Implement**

In `src/lib/rollup.ts` add:
```ts
import { PERIOD_KEYS, resolvePeriod, type PeriodKey } from '@/lib/periods';

export function affectedPeriods(dates: string[], now = new Date()): PeriodKey[] {
  const affected: PeriodKey[] = [];
  for (const pk of PERIOD_KEYS) {
    const range = resolvePeriod(pk, now);
    for (const d of dates) {
      if (d >= range.start && d <= range.end) {
        affected.push(pk as PeriodKey);
        break;
      }
    }
  }
  return affected;
}

// Modify buildRollups signature:
export async function buildRollups(
  dbIn: DB = defaultDb,
  opts: { onlyDates?: string[] } = {}
): Promise<{ cached: number }> {
  const periods = opts.onlyDates
    ? affectedPeriods(opts.onlyDates)
    : (PERIOD_KEYS as readonly string[]);
  // ...existing loop but iterate `periods` instead of PERIOD_KEYS
}
```

**Step 4: Run test → PASS**

```bash
pnpm test src/lib/rollup.test.ts --run
```

**Step 5: Commit**

```bash
git add src/lib/rollup.ts src/lib/rollup.test.ts
git commit -m "feat(rollup): incremental rebuild via affectedPeriods(dates)"
```

---

### Task 0.4: Pinterest Windsor banner (daily-cap notice)

**Files:**
- Modify: `src/components/tabs/Pinterest.tsx`
- Modify: `src/app/api/data/pinterest/route.ts` — dodać `lastWindsorUpdate` timestamp

**Step 1:** API update

In `src/app/api/data/pinterest/route.ts`:
```ts
// after getCached:
const { db } = await import('@/lib/db');
const { sql } = await import('drizzle-orm');
const res: any = await db.execute(sql`SELECT MAX(date)::text AS last FROM ad_performance_daily WHERE datasource='pinterest'`);
const lastDay = res.rows?.[0]?.last ?? res[0]?.last ?? null;

return jsonResponse({ period, compare, platform: 'pinterest', payload, windsorLastDay: lastDay });
```

**Step 2:** UI banner

In `PlatformTab.tsx` dodać opcjonalny `infoBanner` prop (obok `warningBanner`). Dla Pinterest wrap:
```tsx
<PlatformTab
  ...
  infoBanner={data?.windsorLastDay
    ? `Windsor.ai odświeża raz dziennie. Ostatnie dane: ${data.windsorLastDay}.`
    : null}
/>
```

**Step 3:** Commit

```bash
git add -A && git commit -m "feat(pinterest): info banner with Windsor last refresh date"
```

---

## Phase 1 — Real-time ads: Meta via Graph API direct

### Task 1.1: Meta Graph API client (TDD)

**Files:**
- Create: `src/lib/sync/meta-graph.ts`
- Create: `src/lib/sync/meta-graph.test.ts`

**Step 1: Write failing test with mocked fetch**

```ts
// src/lib/sync/meta-graph.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncMetaGraph, METRICS } from './meta-graph';

const OLD_FETCH = global.fetch;
beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { global.fetch = OLD_FETCH; });

describe('syncMetaGraph', () => {
  it('requests /insights with time_increment=1 and stores daily rows', async () => {
    const mockRes = {
      data: [
        { campaign_id: '123', campaign_name: 'Test', date_start: '2026-04-01', date_stop: '2026-04-01',
          spend: '100.50', impressions: '5000', clicks: '100',
          actions: [{ action_type: 'purchase', value: '10' }],
          action_values: [{ action_type: 'purchase', value: '1500' }] },
      ],
      paging: {},
    };
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockRes });

    const fakeDb = { insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }) }) };
    const result = await syncMetaGraph(
      { start: '2026-04-01', end: '2026-04-01' },
      { db: fakeDb as any, token: 'fake', accountId: 'act_123' }
    );
    expect(result.rowsWritten).toBe(1);
    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('time_increment=1');
    expect(callArgs[0]).toContain('act_123');
  });
});

describe('METRICS constant', () => {
  it('includes required fields', () => {
    expect(METRICS).toContain('spend');
    expect(METRICS).toContain('actions');
    expect(METRICS).toContain('action_values');
  });
});
```

**Step 2:** Run failing

```bash
pnpm test src/lib/sync/meta-graph.test.ts --run
```

**Step 3:** Implement

```ts
// src/lib/sync/meta-graph.ts
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { adsDaily } from '@/lib/schema';
import { toNum, toNumOrNull, upsertAdsDaily, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const GRAPH_URL = 'https://graph.facebook.com/v22.0';
export const METRICS = [
  'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
  'ctr', 'cpc', 'cpm', 'actions', 'action_values',
  'date_start', 'date_stop',
];

const PURCHASE_ACTIONS = new Set([
  'purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase',
]);

type Insight = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
};

type Response = { data: Insight[]; paging?: { next?: string } };

function extractPurchase(row: Insight) {
  const convRow = row.actions?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  const valRow = row.action_values?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  return {
    conversions: toNum(convRow?.value),
    conversionValue: toNum(valRow?.value),
  };
}

export async function syncMetaGraph(
  range: DateRange,
  opts: { db?: DB; token?: string; accountId?: string } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const token = opts.token ?? process.env.META_GRAPH_API_TOKEN;
  const accountId = opts.accountId ?? process.env.META_ACCOUNT_ID ?? 'act_295812916';
  if (!token) throw new Error('META_GRAPH_API_TOKEN missing');

  const params = new URLSearchParams({
    access_token: token,
    level: 'campaign',
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    time_increment: '1',
    fields: METRICS.join(','),
    limit: '500',
  });

  const allRows: Insight[] = [];
  let url: string | null = `${GRAPH_URL}/${accountId}/insights?${params}`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Meta Graph ${res.status}: ${await res.text()}`);
    const data: Response = await res.json();
    allRows.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }

  // Replace Meta window fully to avoid stale spread rows
  await database.execute(
    sql`DELETE FROM ads_daily WHERE platform='meta' AND date BETWEEN ${range.start} AND ${range.end}`
  );

  const rows: AdsDailyRow[] = [];
  for (const r of allRows) {
    const date = r.date_start;
    if (!date || !r.campaign_id) continue;
    const p = extractPurchase(r);
    rows.push({
      date,
      platform: 'meta',
      accountId,
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name ?? '',
      campaignStatus: null,
      campaignObjective: null,
      adGroupId: null,
      adGroupName: null,
      spend: String(toNum(r.spend)),
      impressions: Math.round(toNum(r.impressions)),
      clicks: Math.round(toNum(r.clicks)),
      ctr: toNumOrNull(r.ctr)?.toString() ?? null,
      cpc: toNumOrNull(r.cpc)?.toString() ?? null,
      cpm: toNumOrNull(r.cpm)?.toString() ?? null,
      conversions: String(p.conversions),
      conversionValue: String(p.conversionValue),
    });
  }
  const rowsWritten = await upsertAdsDaily(database, rows);
  return { rowsWritten };
}
```

**Step 4:** Run tests PASS

```bash
pnpm test src/lib/sync/meta-graph.test.ts --run
```

**Step 5: Commit**

```bash
git add src/lib/sync/meta-graph.ts src/lib/sync/meta-graph.test.ts
git commit -m "feat(meta): direct Facebook Graph API client with real daily time_increment=1"
```

---

### Task 1.2: Swap Meta sync in cron + backfill routes

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`
- Modify: `src/app/api/admin/backfill/route.ts`

**Step 1:** Replace syncMeta calls

In `cron/sync/route.ts`:
```ts
import { syncMetaGraph } from '@/lib/sync/meta-graph';
// replace:
// runWithTracking('meta', () => syncMeta())
// with:
runWithTracking(
  'meta',
  () => syncMetaGraph(last7),
),
```

Same in `backfill/route.ts` — replace `syncMeta()` case with `syncMetaGraph(range)`.

**Step 2:** Build + commit

```bash
pnpm build && git add -A && git commit -m "feat: swap Meta MCP → Graph API direct for real daily data"
```

---

### Task 1.3: Set META_GRAPH_API_TOKEN in Railway

**Step 1:** Set env var

```bash
railway service nextjs-web
railway variable set META_GRAPH_API_TOKEN='<TOKEN>'
```

**Step 2:** Deploy (or trigger)

```bash
railway up --detach
```

**Step 3:** After deploy: fire backfill for April

```bash
DOMAIN="https://nextjs-web-production-30aa.up.railway.app"
SECRET=$(cat /tmp/cron-secret.txt)
curl -X POST "$DOMAIN/api/admin/backfill?key=$SECRET&start=2026-04-01&end=2026-04-17&sources=meta"
```

**Step 4:** Verify in DB
```bash
DATABASE_URL=... node -e "
  select date, sum(spend) from ads_daily where platform='meta' and date>='2026-04-01' group by date order by date;
"
```
Expected: każdy dzień różny spend (nie ten sam!).

---

## Phase 2 — Order status config + Allegro filter

### Task 2.1: Nowa tabela `order_status_config`

**Files:**
- Modify: `src/lib/schema.ts` — new table
- Create: `drizzle/000X_order_status_config.sql`

**Step 1:** Schema

```ts
// src/lib/schema.ts - dodać:
export const orderStatusConfig = pgTable('order_status_config', {
  statusId: integer('status_id').primaryKey(),
  label: text('label').notNull(),
  sourceType: text('source_type'),  // 'SHR', 'ALL' — from BaseLinker
  isValidSale: boolean('is_valid_sale').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Step 2:** Import boolean

```ts
import { pgTable, text, ..., boolean } from 'drizzle-orm/pg-core';
```

**Step 3:** Generate migration + apply

```bash
pnpm db:generate
# edit drizzle/000X.sql → add IF NOT EXISTS
sed -i '' 's/CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' drizzle/000X_*.sql
node --env-file=.env.local --import=tsx scripts/db-migrate.ts
```

**Step 4:** Commit

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat(db): order_status_config table"
```

---

### Task 2.2: Admin endpoint to list + update statuses

**Files:**
- Create: `src/app/api/admin/statuses/route.ts`

**Step 1: Implement**

```ts
// src/app/api/admin/statuses/route.ts
import { db } from '@/lib/db';
import { orderStatusConfig } from '@/lib/schema';
import { BaseLinkerAPI } from '@/lib/sync/baselinker-api';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → fetch live statuses from BaseLinker + merge with our config
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });

  const api = new BaseLinkerAPI(process.env.BASELINKER_API_TOKEN!);
  const live: any = await api.call('getOrderStatusList');

  const existing = await db.select().from(orderStatusConfig);
  const byId = new Map(existing.map((r) => [r.statusId, r]));

  const statuses = (live.statuses ?? []).map((s: any) => ({
    statusId: Number(s.id),
    label: s.name,
    isValidSale: byId.get(Number(s.id))?.isValidSale ?? true,  // default: treat as sale
  }));

  return Response.json({ statuses });
}

// POST → save validity map
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as { statuses: Array<{ statusId: number; label: string; isValidSale: boolean }> };

  for (const s of body.statuses) {
    await db.insert(orderStatusConfig)
      .values({ statusId: s.statusId, label: s.label, isValidSale: s.isValidSale })
      .onConflictDoUpdate({
        target: orderStatusConfig.statusId,
        set: { label: s.label, isValidSale: s.isValidSale, updatedAt: sql`now()` },
      });
  }

  return Response.json({ ok: true, updated: body.statuses.length });
}
```

**Step 2:** Commit

```bash
git add src/app/api/admin/statuses/
git commit -m "feat(api): admin endpoint to configure order status validity"
```

---

### Task 2.3: Admin UI `/admin/statuses`

**Files:**
- Create: `src/app/admin/statuses/page.tsx`

**Step 1: Implement**

```tsx
// src/app/admin/statuses/page.tsx
'use client';
import { useState, useEffect } from 'react';

export default function StatusConfigPage() {
  const [key, setKey] = useState('');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/statuses?key=${key}`);
    if (res.ok) setStatuses((await res.json()).statuses);
    setLoading(false);
  };

  const save = async () => {
    setLoading(true);
    await fetch(`/api/admin/statuses?key=${key}`, {
      method: 'POST',
      body: JSON.stringify({ statuses }),
    });
    setLoading(false);
  };

  const toggle = (id: number) => {
    setStatuses(statuses.map((s) => s.statusId === id ? { ...s, isValidSale: !s.isValidSale } : s));
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Status zamówień — valid sale filter</h1>
      <p className="mb-4 text-sm text-gray-600">Zaznacz które statusy mają być liczone jako przychód.</p>

      <div className="flex gap-2 mb-4">
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="CRON_SECRET" className="border px-3 py-2 rounded flex-1" />
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">Wczytaj</button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Nazwa</th>
            <th className="p-2 text-center">Valid sale</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s.statusId} className="border-t">
              <td className="p-2 font-mono">{s.statusId}</td>
              <td className="p-2">{s.label}</td>
              <td className="p-2 text-center">
                <input type="checkbox" checked={s.isValidSale} onChange={() => toggle(s.statusId)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {statuses.length > 0 && (
        <button onClick={save} disabled={loading} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">Zapisz</button>
      )}
    </div>
  );
}
```

**Step 2:** Commit

```bash
git add src/app/admin/statuses/
git commit -m "feat(admin): UI to pick valid sale statuses"
```

---

### Task 2.4: Use order_status_config in direct SellRocket sync

**Files:**
- Modify: `src/lib/sync/sellrocket-direct.ts`

**Step 1:** Load valid statuses, filter

In `syncSellRocketDirect`:
```ts
import { orderStatusConfig } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// After connecting, load the filter:
const validStatuses = await database.select().from(orderStatusConfig).where(eq(orderStatusConfig.isValidSale, true));
const validSet = new Set(validStatuses.map((r) => r.statusId));

// Inside the loop `for (const { sourceType, sourceId } of sources)`:
const all = await api.getOrdersRange({ fromTs, toTs, sourceType, sourceId });
const filtered = validSet.size > 0 ? all.filter((o) => validSet.has(o.order_status_id)) : all;
// ...aggregate `filtered` into byDate
```

**Step 2:** Commit

```bash
git add src/lib/sync/sellrocket-direct.ts
git commit -m "feat(sellrocket): filter by user-configured valid-sale statuses"
```

---

## Phase 3 — Custom date range picker

### Task 3.1: Install react-day-picker

**Files:**
- Modify: `package.json`

**Step 1:**

```bash
pnpm add react-day-picker date-fns
```

**Step 2:** Commit

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-day-picker for custom range selection"
```

---

### Task 3.2: DateRangePicker component (TDD contract)

**Files:**
- Create: `src/components/ui/DateRangePicker.tsx`
- Create: `src/components/ui/DateRangePicker.test.tsx`

Test contract: emits `custom_YYYY-MM-DD_YYYY-MM-DD` key.

**Step 1:** Test

```tsx
// src/components/ui/DateRangePicker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { rangeToPeriodKey } from './DateRangePicker';

describe('rangeToPeriodKey', () => {
  it('formats a range as custom_ key', () => {
    const from = new Date('2026-04-05');
    const to = new Date('2026-04-12');
    expect(rangeToPeriodKey({ from, to })).toBe('custom_2026-04-05_2026-04-12');
  });
});
```

**Step 2: Run failing, then implement**

```tsx
// src/components/ui/DateRangePicker.tsx
'use client';

import { useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export function rangeToPeriodKey(range: { from: Date; to: Date }): string {
  return `custom_${format(range.from, 'yyyy-MM-dd')}_${format(range.to, 'yyyy-MM-dd')}`;
}

export function DateRangePicker({ onSelect, initial }: { onSelect: (key: string) => void; initial?: DateRange }) {
  const [range, setRange] = useState<DateRange | undefined>(initial);

  return (
    <div className="p-2">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={(r) => {
          setRange(r);
          if (r?.from && r?.to) onSelect(rangeToPeriodKey({ from: r.from, to: r.to }));
        }}
        locale={pl}
        numberOfMonths={2}
      />
    </div>
  );
}
```

**Step 3: Integrate in FilterBar**

In `FilterBar.tsx`, add "Zakres niestandardowy" option to Select's period list. When selected, popover opens DateRangePicker.

**Step 4: Commit**

```bash
pnpm test src/components/ui/DateRangePicker.test.tsx --run
git add -A && git commit -m "feat(ui): custom date range picker (pl-PL, 2-month view)"
```

---

### Task 3.3: API route to handle custom periods (bypass cache)

**Files:**
- Modify: `src/lib/api.ts` — `getCached` returns null for custom_*, fallback to live rollup

**Step 1:** In `src/lib/api.ts`:

```ts
export async function getCached(
  platform: Platform,
  period: PeriodKey,
  compare: CompareKey,
  db: DB = defaultDb
): Promise<RollupPayload | null> {
  // Custom ranges aren't cached — compute on the fly.
  if (period.startsWith('custom_')) {
    const { buildOneLive } = await import('@/lib/rollup');
    const range = resolvePeriod(period);
    const compareRange = resolveCompare(range, compare);
    return buildOneLive(db, platform, range, compareRange);
  }
  // ...existing cached path
}
```

**Step 2:** Export `buildOneLive` from rollup.ts (rename current `buildOne` → `buildOneLive`, make it public).

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(api): custom date ranges bypass cache, compute live"
```

---

## Phase 4 — Products table + per-kategoria/kolekcja

### Task 4.1: products_daily table

**Files:**
- Modify: `src/lib/schema.ts`
- Generate + apply migration

**Step 1:** Schema

```ts
export const productsDaily = pgTable(
  'products_daily',
  {
    date: date('date').notNull(),
    sku: text('sku').notNull(),
    productName: text('product_name').notNull(),
    category: text('category'),
    collection: text('collection'),
    source: text('source').notNull(), // 'shr' | 'allegro'
    quantity: integer('quantity').notNull().default(0),
    revenue: numeric('revenue', { precision: 14, scale: 4 }).notNull().default('0'),
    orders: integer('orders').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.sku, t.source] }),
    skuIdx: index('products_daily_sku_idx').on(t.sku),
    categoryIdx: index('products_daily_category_idx').on(t.category),
  })
);
```

**Step 2:** Generate + apply (idempotent).

**Step 3:** Commit `feat(db): products_daily table for per-sku analytics`.

---

### Task 4.2: parseSkuToCategoryCollection (TDD)

**Files:**
- Create: `src/lib/sync/sku-parser.ts`
- Create: `src/lib/sync/sku-parser.test.ts`

**Step 1: Tests from real Room99 names**

```ts
import { describe, it, expect } from 'vitest';
import { parseSkuToCategoryCollection } from './sku-parser';

describe('parseSkuToCategoryCollection', () => {
  it('parses typical FIRANA NOVELIA name', () => {
    const r = parseSkuToCategoryCollection('FIRANA NOVELIA - BIAŁA 140x250 Taśma');
    expect(r.category).toBe('FIRANA');
    expect(r.collection).toBe('NOVELIA');
  });
  it('parses ZASŁONA AURA', () => {
    const r = parseSkuToCategoryCollection('ZASŁONA AURA - KREMOWA 140x250 SREBRNA PRZELOTKA');
    expect(r.category).toBe('ZASŁONA');
    expect(r.collection).toBe('AURA');
  });
  it('returns null fields for unparseable names', () => {
    const r = parseSkuToCategoryCollection('Losowy produkt bez struktury');
    expect(r.category).toBeNull();
    expect(r.collection).toBeNull();
  });
});
```

**Step 2: Implement**

```ts
// src/lib/sync/sku-parser.ts
export function parseSkuToCategoryCollection(name: string): {
  category: string | null;
  collection: string | null;
} {
  // Pattern: KATEGORIA KOLEKCJA - rest
  const m = /^([A-ZŁŚĆŻŹĄĘÓŃ]+)\s+([A-ZŁŚĆŻŹĄĘÓŃ][A-ZŁŚĆŻŹĄĘÓŃ0-9]+)\s*-/.exec(name);
  if (!m) return { category: null, collection: null };
  return { category: m[1], collection: m[2] };
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(sku): parse Room99 product names → category/collection"
```

---

### Task 4.3: syncProducts from BaseLinker getOrders

**Files:**
- Create: `src/lib/sync/products.ts`

**Step 1:** Implement (skip TDD here — uses live BaseLinker, integration-tested via backfill)

```ts
// src/lib/sync/products.ts
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { productsDaily, orderStatusConfig } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { BaseLinkerAPI } from './baselinker-api';
import { parseSkuToCategoryCollection } from './sku-parser';
import { SOURCE_BUCKETS, type Bucket } from './sellrocket-direct';
import { type DateRange } from '@/lib/periods';

export async function syncProducts(
  range: DateRange,
  opts: { db?: DB; buckets?: Bucket[] } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const buckets = opts.buckets ?? ['shr', 'allegro'];

  const token = process.env.BASELINKER_API_TOKEN;
  if (!token) throw new Error('BASELINKER_API_TOKEN missing');
  const api = new BaseLinkerAPI(token);

  const valid = await database.select().from(orderStatusConfig).where(eq(orderStatusConfig.isValidSale, true));
  const validSet = new Set(valid.map((r) => r.statusId));

  const fromTs = Math.floor(new Date(range.start + 'T00:00:00Z').getTime() / 1000);
  const toTs = Math.floor(new Date(range.end + 'T23:59:59Z').getTime() / 1000);

  let rowsWritten = 0;

  for (const bucket of buckets) {
    const sources = SOURCE_BUCKETS[bucket];
    for (const { sourceType, sourceId } of sources) {
      const orders = await api.getOrdersRange({ fromTs, toTs, sourceType, sourceId });
      const keep = validSet.size > 0 ? orders.filter((o) => validSet.has(o.order_status_id)) : orders;

      // Aggregate per (date, sku)
      const agg = new Map<string, any>();
      for (const o of keep) {
        const date = new Date(o.date_confirmed * 1000).toISOString().slice(0, 10);
        for (const p of o.products) {
          const sku = p.sku || p.ean || `noname-${p.product_id}`;
          const key = `${date}|${sku}`;
          const { category, collection } = parseSkuToCategoryCollection(p.name);
          const revenue = p.price_brutto * p.quantity;
          let e = agg.get(key);
          if (!e) {
            e = { date, sku, productName: p.name, category, collection,
                  source: bucket, quantity: 0, revenue: 0, orders: 0 };
            agg.set(key, e);
          }
          e.quantity += p.quantity;
          e.revenue += revenue;
          e.orders += 1; // orders containing this product (may double-count if product appears in 2 orders)
        }
      }

      for (const row of agg.values()) {
        await database.insert(productsDaily).values({
          ...row,
          revenue: row.revenue.toString(),
        }).onConflictDoUpdate({
          target: [productsDaily.date, productsDaily.sku, productsDaily.source],
          set: {
            productName: sql`excluded.product_name`,
            category: sql`excluded.category`,
            collection: sql`excluded.collection`,
            quantity: sql`excluded.quantity`,
            revenue: sql`excluded.revenue`,
            orders: sql`excluded.orders`,
            updatedAt: sql`now()`,
          },
        });
        rowsWritten++;
      }
    }
  }
  return { rowsWritten };
}
```

**Step 2: Wire into backfill route**

In `src/app/api/admin/backfill/route.ts` dodać case 'products' → syncProducts.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(products): per-sku/category/collection sync from BaseLinker"
```

---

### Task 4.4: Products API rewrite (use products_daily + YoY)

**Files:**
- Modify: `src/app/api/data/top-products/route.ts`

Replace GA4 items call with SQL queries on products_daily. Compute:
- Per-category aggregate (Shoper + Allegro)
- YoY = same dates one year ago
- Alerts (as per Section 3 of design)

**Step 1: Implement**

```ts
// src/app/api/data/top-products/route.ts (rewrite)
import { parseFilters, jsonResponse, errorResponse } from '@/lib/api';
import { resolvePeriod } from '@/lib/periods';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AggRow = { group: string; shr_revenue: number; allegro_revenue: number; shr_qty: number; allegro_qty: number };

async function aggregateByLevel(level: 'category' | 'collection' | 'sku', range: { start: string; end: string }) {
  const col = level === 'category' ? sql`category` : level === 'collection' ? sql`collection` : sql`sku`;
  const res: any = await db.execute(sql`
    SELECT
      ${col} AS "group",
      SUM(CASE WHEN source='shr' THEN revenue ELSE 0 END)::float AS shr_revenue,
      SUM(CASE WHEN source='allegro' THEN revenue ELSE 0 END)::float AS allegro_revenue,
      SUM(CASE WHEN source='shr' THEN quantity ELSE 0 END)::int AS shr_qty,
      SUM(CASE WHEN source='allegro' THEN quantity ELSE 0 END)::int AS allegro_qty
    FROM products_daily
    WHERE date BETWEEN ${range.start} AND ${range.end} AND ${col} IS NOT NULL
    GROUP BY ${col}
    ORDER BY (SUM(CASE WHEN source='shr' THEN revenue ELSE 0 END) + SUM(CASE WHEN source='allegro' THEN revenue ELSE 0 END)) DESC
  `);
  return (res.rows ?? res) as AggRow[];
}

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const url = new URL(req.url);
  const level = (url.searchParams.get('level') as 'category' | 'collection' | 'sku') ?? 'category';
  const range = resolvePeriod(period);

  // YoY range
  const y = (d: string) => {
    const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() - 1);
    return x.toISOString().slice(0, 10);
  };
  const yoyRange = { start: y(range.start), end: y(range.end) };

  const [current, yoy] = await Promise.all([
    aggregateByLevel(level, range),
    aggregateByLevel(level, yoyRange),
  ]);
  const yoyByGroup = new Map(yoy.map((r) => [r.group, r]));

  const enriched = current.map((r) => {
    const y = yoyByGroup.get(r.group);
    const total = r.shr_revenue + r.allegro_revenue;
    const yoyTotal = y ? y.shr_revenue + y.allegro_revenue : null;
    const yoyDelta = yoyTotal && yoyTotal > 0 ? (total - yoyTotal) / yoyTotal : null;
    const alerts: string[] = [];
    if (yoyDelta != null && yoyDelta < -0.5) alerts.push('Spadek YoY > 50%');
    else if (yoyDelta != null && yoyDelta < -0.2) alerts.push('Spadek YoY > 20%');
    if (r.allegro_revenue > r.shr_revenue && r.shr_revenue > 0) alerts.push('Allegro wyprzedza Shoper');
    if (y && y.shr_qty + y.allegro_qty > 100 && r.shr_qty + r.allegro_qty < 10) alerts.push('Przeoptymalizowane');
    if (yoyDelta != null && yoyDelta > 3) alerts.push('Breakout +300%');
    return {
      group: r.group,
      shrRevenue: r.shr_revenue,
      allegroRevenue: r.allegro_revenue,
      shrQty: r.shr_qty,
      allegroQty: r.allegro_qty,
      total,
      yoyTotal,
      yoyDelta,
      alerts,
    };
  });

  return jsonResponse({ period, compare, level, range, yoyRange, items: enriched, alerts: enriched.filter((x) => x.alerts.length) });
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(products): Shoper vs Allegro per category/collection/sku with YoY + alerts"
```

---

### Task 4.5: TopProductsTab drill-down UI

**Files:**
- Modify: `src/components/tabs/TopProducts.tsx`

Build level-switcher (Kategoria → Kolekcja → SKU). Each row clickable to drill down. Already refactored in earlier session — update fields to shrRevenue/allegroRevenue/alerts.

**Step 1: Rewrite** (see design Sekcja 3)

(code omitted for brevity — just update columns and add level-switch buttons)

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(tab): Top Products 3-level drill-down + Shoper-vs-Allegro per row"
```

---

## Phase 5 — Webhook + SSE real-time

### Task 5.1: BaseLinker webhook receiver

**Files:**
- Create: `src/app/api/webhook/baselinker/route.ts`

**Step 1:** Implement

```ts
// src/app/api/webhook/baselinker/route.ts
import { db } from '@/lib/db';
import { sellrocketDaily } from '@/lib/schema';
import { BaseLinkerAPI } from '@/lib/sync/baselinker-api';
import { sql } from 'drizzle-orm';
import { notifyLive } from '@/lib/live-bus';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as { event?: string; order_id?: number };
  if (!body.order_id) return Response.json({ ok: false, reason: 'no order_id' });

  const api = new BaseLinkerAPI(process.env.BASELINKER_API_TOKEN!);
  const res: any = await api.call('getOrders', { order_id: body.order_id, include_products: true });
  const order = res.orders?.[0];
  if (!order) return Response.json({ ok: false, reason: 'order not found' });

  const date = new Date(order.date_confirmed * 1000).toISOString().slice(0, 10);
  const isShoper = order.order_source_id === 9;
  const isAllegro = order.order_source_id === 7 || order.order_source_id === 8;
  if (!isShoper && !isAllegro) return Response.json({ ok: true, skipped: 'non-tracked source' });

  const source = isShoper ? 'shr' : 'allegro';
  const revenue = Number(order.payment_done ?? 0) || order.products.reduce((s: number, p: any) => s + p.price_brutto * p.quantity, 0);

  // Recompute day total cheaply
  await db.execute(sql`
    UPDATE sellrocket_daily
    SET order_count = order_count + 1, revenue = revenue + ${revenue}, updated_at = now()
    WHERE date = ${date} AND source = ${source}
  `);

  notifyLive({ type: 'order', source, date, revenue });
  return Response.json({ ok: true, date, source, revenue });
}
```

**Step 2:** `live-bus.ts` — simple in-memory pub/sub (works single-container Railway).

**Step 3:** Commit

```bash
git add -A && git commit -m "feat(realtime): BaseLinker webhook receiver with live-bus notification"
```

---

### Task 5.2: SSE stream endpoint

**Files:**
- Create: `src/app/api/live/route.ts`
- Create: `src/lib/live-bus.ts`

**Step 1:** Implement

```ts
// src/lib/live-bus.ts
type Listener = (msg: any) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyLive(msg: any) {
  for (const l of listeners) l(msg);
}
```

```ts
// src/app/api/live/route.ts
import { subscribe } from '@/lib/live-bus';

export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsub = subscribe((msg) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      });
      const keepalive = setInterval(() => controller.enqueue(encoder.encode(`: keepalive\n\n`)), 15000);
      return () => { clearInterval(keepalive); unsub(); };
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Step 2:** Dashboard listens — add to `providers.tsx`:

```tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const es = new EventSource('/api/live');
  es.onmessage = () => {
    // Trigger SWR revalidation on any live event
    mutate(() => true, undefined, { revalidate: true });
  };
  return () => es.close();
}, []);
```

**Step 3:** Commit

```bash
git add -A && git commit -m "feat(realtime): SSE /api/live stream + UI auto-refresh on events"
```

---

### Task 5.3: Register webhook in BaseLinker

**Step 1:** Via BaseLinker UI → Panel SellRocket → Webhooki → nowy webhook:
- URL: `https://nextjs-web-production-30aa.up.railway.app/api/webhook/baselinker?key=<CRON_SECRET>`
- Event: `ORDER_NEW`, `ORDER_STATUS_CHANGED`

**Step 2:** Test with a small order (user-action).

---

## Phase 6 — Deploy + verify

### Task 6.1: Full deploy

```bash
railway up --detach --service nextjs-web
```

Monitor with task output.

### Task 6.2: Fire full backfill

```bash
DOMAIN="https://nextjs-web-production-30aa.up.railway.app"
SECRET=$(cat /tmp/cron-secret.txt)
curl -X POST "$DOMAIN/api/admin/backfill?key=$SECRET&start=2026-04-01&end=2026-04-17&sources=meta,google_ads,criteo,ga4,pinterest,sellrocket,products"
curl -X POST "$DOMAIN/api/admin/backfill?key=$SECRET&start=2025-04-01&end=2025-04-17&sources=products"  # YoY source
```

### Task 6.3: Acceptance checks

- [ ] SHR April 1-16 = **998 534 zł ±1%** (reference 999 486)
- [ ] Allegro (po wybraniu valid statuses) = **916 031 zł ±3%**
- [ ] Meta April 1-16 = **49 374 zł ±3%** (każdy dzień inny!)
- [ ] Custom range picker działa (np. 04-05 → 04-12)
- [ ] Funnel monotonicznie opadające bary
- [ ] Top Products → kategorie → YoY + alerty widoczne
- [ ] Test order → widoczny w < 20 s (SSE)

---

## Skills chain

- `@superpowers:executing-plans` — ten plan
- `@superpowers:test-driven-development` — Phase 0.3, 1.1, 3.2, 4.2 (TDD)
- `@superpowers:verification-before-completion` — przed każdym commitem
- `@frontend-design` — Phase 3.2 (DateRangePicker), 4.5 (drill-down UX)
