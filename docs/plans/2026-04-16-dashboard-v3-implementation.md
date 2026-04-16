# Dashboard v3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Rebuild Room99 performance dashboard as a single Next.js 16 app on Railway, with Postgres-backed rollups from MCP sync + Windsor.ai Pinterest feed, 10 tabs in Apple Keynote light style.

**Architecture:** See `docs/plans/2026-04-16-dashboard-v3-design.md`. Single `nextjs-web` Railway service calling MCP on cron (every 30 min) to populate `ads_daily` + `ga4_daily`. Rollup job pre-computes `dashboard_cache` per period/platform. Frontend reads cache via `/api/data/*`.

**Tech Stack:** Next.js 16.2.3 (App Router, breaking changes vs Next 15 — **always check `node_modules/next/dist/docs/` before using any API**), TypeScript strict, Drizzle ORM, Postgres (Railway), Tailwind 4 + shadcn/ui, Zustand, SWR, Recharts, TanStack Table, Framer Motion, Vitest + testcontainers, Playwright, Sentry.

**Existing state (2026-04-16):**
- Next.js 16 project already scaffolded at repo root
- `public/dashboard.html` + existing `/api/data/*` routes use Neon + Vercel — **we replace these entirely**
- Windsor.ai live, writing to `ad_performance_daily` (Pinterest, 30d, 838 rows)
- Railway Postgres up at `mainline.proxy.rlwy.net:55910/railway`, internal `postgres.railway.internal:5432/railway`
- Logo at `public/brand/room99-logo.png`
- Old `sync-worker` Railway service runs but we will decommission it

**Account IDs (from memory + design §11.1):**
- GA4 property: `315856757`
- Google Ads customer: `1331139339`
- Meta account: `act_295812916`
- Criteo advertiser: `55483`

---

## Phase 0 — Project setup

### Task 0.1: Clean legacy deps + add new deps

**Files:**
- Modify: `package.json`

**Step 1: Remove legacy deps**

Run:
```bash
pnpm remove @neondatabase/serverless @vercel/kv @vercel/postgres
```
Expected: three packages removed.

**Step 2: Add runtime deps**

Run:
```bash
pnpm add drizzle-orm pg zustand swr @tanstack/react-table framer-motion @sentry/nextjs
pnpm add -D drizzle-kit @types/pg vitest @vitest/ui @testcontainers/postgresql @playwright/test tsx
```
Expected: deps installed, `pnpm-lock.yaml` updated.

**Step 3: Verify install**

Run: `pnpm ls drizzle-orm pg zustand swr --depth 0`
Expected: all four listed with versions.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: swap Neon/Vercel deps for Drizzle + testing toolkit"
```

---

### Task 0.2: Remove Vercel config + old Neon Next.js artifacts

**Files:**
- Delete: `vercel.json`
- Delete: `src/app/api/data/` entire directory (old Neon-based routes — we rewrite in Phase 5)
- Delete: `src/app/google-ads/`, `src/app/meta-ads/`, `src/app/pinterest-ads/`, `src/app/criteo/`, `src/app/performance-marketing/`, `src/app/conversion-funnel/`, `src/app/product-catalogs/`, `src/app/top-products/`, `src/app/traffic-sources/` (old per-tab routes — v3 is SPA hybrid)
- Delete: `public/dashboard.html` (old static dashboard)
- Delete: `src/app/api/upload-pinterest/`, `src/app/api/cron/sync/` (old, rewritten in Phase 3)
- Keep: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/api/admin/`, `src/lib/` (inspect individually in later tasks)

**Step 1: Delete directories/files**

Run:
```bash
rm -rf vercel.json src/app/api/data src/app/google-ads src/app/meta-ads src/app/pinterest-ads src/app/criteo src/app/performance-marketing src/app/conversion-funnel src/app/product-catalogs src/app/top-products src/app/traffic-sources src/app/api/upload-pinterest src/app/api/cron public/dashboard.html
```
Expected: files gone.

**Step 2: Verify `pnpm build` still works on minimal app**

Run: `pnpm build`
Expected: successful build (Next shows one page = `/`).

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: strip Vercel config and v2 per-tab routes"
```

---

### Task 0.3: Configure Vitest + Playwright

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Modify: `package.json` (add scripts)
- Modify: `tsconfig.json` (add vitest types)

**Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

**Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

**Step 3: Add scripts to `package.json`**

Add inside `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 4: Add vitest/globals to tsconfig.json `compilerOptions.types`**

```json
"types": ["vitest/globals", "node"]
```

**Step 5: Smoke test**

Run: `pnpm test --run` — expected no tests found, exit 0.
Run: `pnpm exec playwright install chromium` — installs browser.

**Step 6: Commit**

```bash
git add vitest.config.ts playwright.config.ts package.json tsconfig.json
git commit -m "chore: configure Vitest and Playwright"
```

---

## Phase 1 — Database layer

### Task 1.1: Drizzle config + client

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db.ts` (overwrites any existing)
- Create: `.env.local` (gitignored — local dev only)
- Modify: `.gitignore` (ensure `.env*.local` ignored)

**Step 1: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**Step 2: `src/lib/db.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Railway internal connections don't need SSL, public proxy does.
    ssl: process.env.DATABASE_URL?.includes('proxy.rlwy.net')
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

**Step 3: `.env.local` (do NOT commit)**

```
DATABASE_URL=postgresql://postgres:VdqvOtDGdiIPvrUPemtrAUvJtjWMcxuE@mainline.proxy.rlwy.net:55910/railway
```

**Step 4: Ensure `.env*.local` in `.gitignore`**

Verify line exists, add if missing.

**Step 5: Commit (NO .env.local)**

```bash
git add drizzle.config.ts src/lib/db.ts .gitignore
git commit -m "feat(db): add Drizzle client for Postgres"
```

---

### Task 1.2: Drizzle schema for 5 tables

**Files:**
- Create: `src/lib/schema.ts`

**Step 1: Write full schema**

```ts
import {
  pgTable, text, date, integer, numeric, timestamp, jsonb, uuid, index, primaryKey,
} from 'drizzle-orm/pg-core';

export const adsDaily = pgTable(
  'ads_daily',
  {
    date: date('date').notNull(),
    platform: text('platform').notNull(), // 'meta' | 'google_ads' | 'criteo'
    accountId: text('account_id').notNull(),
    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    campaignStatus: text('campaign_status'),
    campaignObjective: text('campaign_objective'),
    adGroupId: text('ad_group_id'),
    adGroupName: text('ad_group_name'),
    spend: numeric('spend', { precision: 14, scale: 4 }).notNull().default('0'),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    ctr: numeric('ctr', { precision: 10, scale: 6 }),
    cpc: numeric('cpc', { precision: 10, scale: 4 }),
    cpm: numeric('cpm', { precision: 10, scale: 4 }),
    conversions: numeric('conversions', { precision: 14, scale: 4 }).default('0'),
    conversionValue: numeric('conversion_value', { precision: 14, scale: 4 }).default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.platform, t.campaignId] }),
    platformDateIdx: index('ads_daily_platform_date_idx').on(t.platform, t.date),
    dateIdx: index('ads_daily_date_idx').on(t.date),
  })
);

export const ga4Daily = pgTable(
  'ga4_daily',
  {
    date: date('date').notNull(),
    channelGroup: text('channel_group').notNull(),
    source: text('source').notNull(),
    medium: text('medium').notNull(),
    sessions: integer('sessions').notNull().default(0),
    users: integer('users').notNull().default(0),
    newUsers: integer('new_users').notNull().default(0),
    engagedSessions: integer('engaged_sessions').notNull().default(0),
    bounceRate: numeric('bounce_rate', { precision: 6, scale: 4 }),
    transactions: integer('transactions').notNull().default(0),
    revenue: numeric('revenue', { precision: 14, scale: 4 }).notNull().default('0'),
    itemsViewed: integer('items_viewed').notNull().default(0),
    addToCart: integer('add_to_cart').notNull().default(0),
    beginCheckout: integer('begin_checkout').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.channelGroup, t.source, t.medium] }),
    dateIdx: index('ga4_daily_date_idx').on(t.date),
  })
);

// Windsor writes here. We do NOT alter — define schema read-only.
export const adPerformanceDaily = pgTable('ad_performance_daily', {
  accountName: text('account_name'),
  adGroup: text('ad_group'),
  campaign: text('campaign'),
  campaignObjective: text('campaign_objective'),
  campaignStatus: text('campaign_status'),
  clicks: numeric('clicks'),
  conversions: text('conversions'),
  conversionValue: text('conversion_value'),
  cpc: numeric('cpc'),
  cpm: numeric('cpm'),
  ctr: text('ctr'),
  datasource: text('datasource'),
  date: date('date'),
  impressions: numeric('impressions'),
  roas: text('roas'),
  source: text('source'),
  spend: numeric('spend'),
});

export const dashboardCache = pgTable(
  'dashboard_cache',
  {
    periodKey: text('period_key').notNull(),
    platform: text('platform').notNull(),
    compareKey: text('compare_key').notNull().default('none'),
    payload: jsonb('payload').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.periodKey, t.platform, t.compareKey] }),
  })
);

export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), // 'running' | 'success' | 'partial' | 'failed'
  source: text('source').notNull(),
  rowsWritten: integer('rows_written').default(0),
  error: text('error'),
});
```

**Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: `drizzle/0000_xxx.sql` created with CREATE TABLE statements for all 5 tables.

**Step 3: Push to DB**

Run: `pnpm db:push`
Expected: prompts for confirmation; answer yes for adding the new tables; `ad_performance_daily` already exists — accept "existing table" path (Drizzle should offer to introspect, choose "skip" if it doesn't match exactly — this table is Windsor-managed).

**Step 4: Verify**

Run in psql:
```sql
\dt
```
Expected: 5 tables visible.

**Step 5: Commit**

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat(db): Drizzle schema for ads_daily, ga4_daily, dashboard_cache, sync_runs + read-only ad_performance_daily"
```

---

### Task 1.3: Testcontainers helper for integration tests

**Files:**
- Create: `src/test/db-container.ts`

**Step 1: Write helper**

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@/lib/schema';

export type TestDB = ReturnType<typeof drizzle<typeof schema>>;

export async function startTestDB(): Promise<{
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: TestDB;
  stop: () => Promise<void>;
}> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return {
    container,
    pool,
    db,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
```

**Step 2: Quick smoke test**

Create `src/test/db-container.test.ts`:

```ts
import { startTestDB } from './db-container';
import { adsDaily } from '@/lib/schema';

test('can connect and query ads_daily', async () => {
  const { db, stop } = await startTestDB();
  const rows = await db.select().from(adsDaily);
  expect(rows).toEqual([]);
  await stop();
}, 60_000);
```

Run: `pnpm test src/test/db-container.test.ts --run`
Expected: PASS (Docker required on dev machine).

**Step 3: Commit**

```bash
git add src/test/
git commit -m "test: testcontainers helper for integration tests"
```

---

## Phase 2 — Core libs (TDD)

**Apply `@superpowers:test-driven-development` for this entire phase.**

### Task 2.1: `lib/periods.ts` — date range + compare

**Files:**
- Create: `src/lib/periods.test.ts`
- Create: `src/lib/periods.ts`

**Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { resolvePeriod, resolveCompare, PERIOD_KEYS, type PeriodKey, type CompareKey } from './periods';

const TODAY = new Date('2026-04-16T12:00:00Z'); // fixed reference

describe('resolvePeriod', () => {
  it('today = today only', () => {
    expect(resolvePeriod('today', TODAY)).toEqual({
      start: '2026-04-16', end: '2026-04-16',
    });
  });

  it('yesterday = yesterday only', () => {
    expect(resolvePeriod('yesterday', TODAY)).toEqual({
      start: '2026-04-15', end: '2026-04-15',
    });
  });

  it('last_7d = 7 days ending yesterday', () => {
    expect(resolvePeriod('last_7d', TODAY)).toEqual({
      start: '2026-04-09', end: '2026-04-15',
    });
  });

  it('last_30d = 30 days ending yesterday', () => {
    expect(resolvePeriod('last_30d', TODAY)).toEqual({
      start: '2026-03-17', end: '2026-04-15',
    });
  });

  it('last_90d = 90 days ending yesterday', () => {
    expect(resolvePeriod('last_90d', TODAY)).toEqual({
      start: '2026-01-16', end: '2026-04-15',
    });
  });

  it('this_month = 1st of current month to today', () => {
    expect(resolvePeriod('this_month', TODAY)).toEqual({
      start: '2026-04-01', end: '2026-04-16',
    });
  });

  it('last_month = full previous month', () => {
    expect(resolvePeriod('last_month', TODAY)).toEqual({
      start: '2026-03-01', end: '2026-03-31',
    });
  });

  it('this_week = Monday of this week to today (ISO)', () => {
    // 2026-04-16 is Thursday; Monday = 2026-04-13
    expect(resolvePeriod('this_week', TODAY)).toEqual({
      start: '2026-04-13', end: '2026-04-16',
    });
  });

  it('last_week = Monday to Sunday of previous week', () => {
    expect(resolvePeriod('last_week', TODAY)).toEqual({
      start: '2026-04-06', end: '2026-04-12',
    });
  });

  it('this_quarter = Q2 so Apr 1 to today', () => {
    expect(resolvePeriod('this_quarter', TODAY)).toEqual({
      start: '2026-04-01', end: '2026-04-16',
    });
  });

  it('last_quarter = full Q1 2026', () => {
    expect(resolvePeriod('last_quarter', TODAY)).toEqual({
      start: '2026-01-01', end: '2026-03-31',
    });
  });

  it('ytd = Jan 1 to today', () => {
    expect(resolvePeriod('ytd', TODAY)).toEqual({
      start: '2026-01-01', end: '2026-04-16',
    });
  });

  it('custom = passes through', () => {
    expect(resolvePeriod('custom_2026-03-01_2026-04-15', TODAY)).toEqual({
      start: '2026-03-01', end: '2026-04-15',
    });
  });

  it('custom invalid throws', () => {
    expect(() => resolvePeriod('custom_not-a-date_also-bad', TODAY)).toThrow();
  });
});

describe('resolveCompare', () => {
  it('previous_period shifts window back by its length', () => {
    const period = { start: '2026-03-17', end: '2026-04-15' }; // 30 days
    expect(resolveCompare(period, 'previous_period')).toEqual({
      start: '2026-02-15', end: '2026-03-16',
    });
  });

  it('same_period_last_year shifts by 1 year', () => {
    const period = { start: '2026-03-17', end: '2026-04-15' };
    expect(resolveCompare(period, 'same_period_last_year')).toEqual({
      start: '2025-03-17', end: '2025-04-15',
    });
  });

  it('same_period_last_quarter shifts by ~90 days', () => {
    const period = { start: '2026-04-01', end: '2026-04-16' };
    expect(resolveCompare(period, 'same_period_last_quarter')).toEqual({
      start: '2026-01-01', end: '2026-01-16',
    });
  });

  it('none returns null', () => {
    const period = { start: '2026-04-01', end: '2026-04-16' };
    expect(resolveCompare(period, 'none')).toBeNull();
  });
});

describe('PERIOD_KEYS contains 13 presets', () => {
  it('lists all', () => {
    expect(PERIOD_KEYS).toEqual([
      'today', 'yesterday',
      'last_7d', 'last_30d', 'last_90d',
      'this_week', 'last_week',
      'this_month', 'last_month',
      'this_quarter', 'last_quarter',
      'this_year', 'ytd',
    ]);
  });
});
```

**Step 2: Run tests — expect ALL FAIL**

Run: `pnpm test src/lib/periods.test.ts --run`
Expected: fail with "Cannot find module './periods'".

**Step 3: Implement `src/lib/periods.ts`**

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_KEYS = [
  'today', 'yesterday',
  'last_7d', 'last_30d', 'last_90d',
  'this_week', 'last_week',
  'this_month', 'last_month',
  'this_quarter', 'last_quarter',
  'this_year', 'ytd',
] as const;

export type PresetPeriodKey = typeof PERIOD_KEYS[number];
export type PeriodKey = PresetPeriodKey | `custom_${string}_${string}`;

export type CompareKey = 'previous_period' | 'same_period_last_year' | 'same_period_last_quarter' | 'none';

export type DateRange = { start: string; end: string };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return utcDate(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function startOfMonth(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return utcDate(d.getUTCFullYear(), q * 3, 1);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return utcDate(d.getUTCFullYear(), q * 3 + 3, 0);
}

function startOfISOWeek(d: Date): Date {
  // Monday = 1, Sunday = 0
  const day = d.getUTCDay() || 7;
  return addDays(d, -(day - 1));
}

export function resolvePeriod(key: PeriodKey, now: Date = new Date()): DateRange {
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterday = addDays(today, -1);

  switch (key) {
    case 'today': return { start: fmt(today), end: fmt(today) };
    case 'yesterday': return { start: fmt(yesterday), end: fmt(yesterday) };
    case 'last_7d': return { start: fmt(addDays(yesterday, -6)), end: fmt(yesterday) };
    case 'last_30d': return { start: fmt(addDays(yesterday, -29)), end: fmt(yesterday) };
    case 'last_90d': return { start: fmt(addDays(yesterday, -89)), end: fmt(yesterday) };
    case 'this_week': return { start: fmt(startOfISOWeek(today)), end: fmt(today) };
    case 'last_week': {
      const thisMonday = startOfISOWeek(today);
      const lastMonday = addDays(thisMonday, -7);
      const lastSunday = addDays(thisMonday, -1);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case 'this_month': return { start: fmt(startOfMonth(today)), end: fmt(today) };
    case 'last_month': {
      const firstOfThis = startOfMonth(today);
      const lastOfPrev = addDays(firstOfThis, -1);
      return { start: fmt(startOfMonth(lastOfPrev)), end: fmt(lastOfPrev) };
    }
    case 'this_quarter': return { start: fmt(startOfQuarter(today)), end: fmt(today) };
    case 'last_quarter': {
      const firstOfThisQ = startOfQuarter(today);
      const lastOfPrevQ = addDays(firstOfThisQ, -1);
      return { start: fmt(startOfQuarter(lastOfPrevQ)), end: fmt(endOfQuarter(lastOfPrevQ)) };
    }
    case 'this_year':
    case 'ytd':
      return { start: fmt(utcDate(today.getUTCFullYear(), 0, 1)), end: fmt(today) };
    default: {
      const m = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
      if (!m) throw new Error(`Invalid period key: ${key}`);
      return { start: m[1], end: m[2] };
    }
  }
}

export function resolveCompare(period: DateRange, compare: CompareKey): DateRange | null {
  if (compare === 'none') return null;
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

  if (compare === 'previous_period') {
    const newEnd = addDays(start, -1);
    const newStart = addDays(newEnd, -(lengthDays - 1));
    return { start: fmt(newStart), end: fmt(newEnd) };
  }
  if (compare === 'same_period_last_year') {
    return {
      start: fmt(utcDate(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate())),
      end: fmt(utcDate(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate())),
    };
  }
  if (compare === 'same_period_last_quarter') {
    return { start: fmt(addDays(start, -90)), end: fmt(addDays(end, -90)) };
  }
  return null;
}
```

**Step 4: Run tests — expect ALL PASS**

Run: `pnpm test src/lib/periods.test.ts --run`
Expected: 17 tests pass.

**Step 5: Commit**

```bash
git add src/lib/periods.ts src/lib/periods.test.ts
git commit -m "feat(periods): resolve period + compare with tests"
```

---

### Task 2.2: `lib/format.ts` — pl-PL formatting (TDD)

**Files:**
- Create: `src/lib/format.test.ts`
- Create: `src/lib/format.ts`

**Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { formatPLN, formatInt, formatPct, formatCTR, formatDateRangePL, formatDelta } from './format';

describe('formatPLN', () => {
  it('formats thousands with space and zł suffix', () => {
    expect(formatPLN(47235)).toBe('47 235 zł');
    expect(formatPLN(1234567.89)).toBe('1 234 568 zł');
    expect(formatPLN(0)).toBe('0 zł');
  });
  it('null/undefined → placeholder', () => {
    expect(formatPLN(null)).toBe('—');
    expect(formatPLN(undefined)).toBe('—');
  });
});

describe('formatInt', () => {
  it('formats with space separators', () => {
    expect(formatInt(52836)).toBe('52 836');
    expect(formatInt(1000000)).toBe('1 000 000');
  });
});

describe('formatPct', () => {
  it('formats decimals as pct with 2 places', () => {
    expect(formatPct(0.0473)).toBe('4,73%');
    expect(formatPct(0.5)).toBe('50,00%');
    expect(formatPct(null)).toBe('—');
  });
});

describe('formatCTR', () => {
  it('formats CTR expressed as decimal', () => {
    expect(formatCTR(0.0047)).toBe('0,47%');
  });
});

describe('formatDateRangePL', () => {
  it('formats same-month range compactly', () => {
    expect(formatDateRangePL('2026-04-01', '2026-04-15')).toBe('1 – 15 kwi 2026');
  });
  it('formats cross-month range', () => {
    expect(formatDateRangePL('2026-03-17', '2026-04-15')).toBe('17 mar – 15 kwi 2026');
  });
  it('formats cross-year range', () => {
    expect(formatDateRangePL('2025-12-15', '2026-01-15')).toBe('15 gru 2025 – 15 sty 2026');
  });
});

describe('formatDelta', () => {
  it('positive with up arrow', () => {
    expect(formatDelta(0.123)).toEqual({ text: '+12,30%', direction: 'up', sign: 'positive' });
  });
  it('negative with down arrow', () => {
    expect(formatDelta(-0.051)).toEqual({ text: '−5,10%', direction: 'down', sign: 'negative' });
  });
  it('zero is neutral', () => {
    expect(formatDelta(0)).toEqual({ text: '0,00%', direction: 'flat', sign: 'neutral' });
  });
  it('null → placeholder', () => {
    expect(formatDelta(null)).toEqual({ text: '—', direction: 'flat', sign: 'neutral' });
  });
});
```

**Step 2: Run tests — expect ALL FAIL**

Run: `pnpm test src/lib/format.test.ts --run`

**Step 3: Implement `src/lib/format.ts`**

```ts
const PLACEHOLDER = '—';

const PL_MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function nbspToThinSpace(s: string) {
  return s.replace(/\u00A0/g, ' '); // Intl sometimes yields NBSP; we want regular space
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return nbspToThinSpace(new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n));
}

export function formatPLN(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return `${formatInt(Math.round(n))} zł`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n * 100)}%`;
}

export function formatCTR(n: number | null | undefined): string {
  return formatPct(n);
}

function plMonth(monthIdx: number) { return PL_MONTH_SHORT[monthIdx]; }

export function formatDateRangePL(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  if (sy === ey && sm === em) {
    return `${sd} – ${ed} ${plMonth(em - 1)} ${ey}`;
  }
  if (sy === ey) {
    return `${sd} ${plMonth(sm - 1)} – ${ed} ${plMonth(em - 1)} ${ey}`;
  }
  return `${sd} ${plMonth(sm - 1)} ${sy} – ${ed} ${plMonth(em - 1)} ${ey}`;
}

export type DeltaFmt = {
  text: string;
  direction: 'up' | 'down' | 'flat';
  sign: 'positive' | 'negative' | 'neutral';
};

export function formatDelta(pct: number | null | undefined): DeltaFmt {
  if (pct == null || !Number.isFinite(pct)) return { text: PLACEHOLDER, direction: 'flat', sign: 'neutral' };
  if (pct === 0) return { text: '0,00%', direction: 'flat', sign: 'neutral' };
  const fmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(pct * 100));
  if (pct > 0) return { text: `+${fmt}%`, direction: 'up', sign: 'positive' };
  return { text: `−${fmt}%`, direction: 'down', sign: 'negative' };
}
```

**Step 4: Run tests — expect ALL PASS**

Run: `pnpm test src/lib/format.test.ts --run`

**Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(format): pl-PL money/percent/date range formatters"
```

---

## Phase 3 — Sync layer

### Task 3.1: MCP client wrapper

**Files:**
- Create: `src/lib/sync/mcp-client.ts`
- Create: `src/lib/sync/mcp-client.test.ts`

**Step 1: Decide contract first**

The existing `src/lib/mcp-client.ts` (from v2) handles JSON-with-text-prefix parsing — we reuse the approach but rewrite clean. MCP servers return JSON-RPC-ish envelope; we need `callTool(serverUrl, toolName, args)` returning parsed content.

**Step 2: Write test (mocked fetch)**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callMCPTool } from './mcp-client';

describe('callMCPTool', () => {
  const OLD_FETCH = global.fetch;
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = OLD_FETCH; });

  it('parses successful MCP response content', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { content: [{ type: 'text', text: JSON.stringify({ rows: [{ id: 1 }] }) }] },
      }),
    });
    const out = await callMCPTool('https://x.mcp/mcp', 'list_campaigns', { limit: 10 });
    expect(out).toEqual({ rows: [{ id: 1 }] });
  });

  it('strips leading text before JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { content: [{ type: 'text', text: 'Fetched 5 rows. {"rows":[1,2]}' }] },
      }),
    });
    expect(await callMCPTool('x', 't', {})).toEqual({ rows: [1, 2] });
  });

  it('throws on error response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ error: { message: 'tool not found' } }),
    });
    await expect(callMCPTool('x', 't', {})).rejects.toThrow(/tool not found/);
  });

  it('retries on 5xx up to 3 times with backoff', async () => {
    const mock = global.fetch as any;
    mock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'busy' });
    mock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'busy' });
    mock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { content: [{ type: 'text', text: '{"rows":[]}' }] } }),
    });
    const out = await callMCPTool('x', 't', {}, { retries: 3, initialBackoffMs: 1 });
    expect(out).toEqual({ rows: [] });
    expect(mock).toHaveBeenCalledTimes(3);
  });
});
```

**Step 3: Implement**

```ts
type MCPOpts = { retries?: number; initialBackoffMs?: number; apiKey?: string };

export async function callMCPTool<T = unknown>(
  serverUrl: string,
  tool: string,
  args: Record<string, unknown>,
  opts: MCPOpts = {}
): Promise<T> {
  const retries = opts.retries ?? 5;
  const baseBackoff = opts.initialBackoffMs ?? 1000;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: tool, arguments: args },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries - 1) {
          await sleep(baseBackoff * 2 ** attempt);
          continue;
        }
        throw new Error(`MCP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(`MCP error: ${data.error.message ?? JSON.stringify(data.error)}`);
      const text = data.result?.content?.[0]?.text;
      if (typeof text !== 'string') throw new Error('MCP response has no text content');
      return extractJSON(text) as T;
    } catch (err) {
      lastError = err;
      if (attempt === retries - 1) throw err;
      await sleep(baseBackoff * 2 ** attempt);
    }
  }
  throw lastError ?? new Error('MCP call failed');
}

function extractJSON(text: string): unknown {
  const first = text.search(/[\[{]/);
  if (first === -1) throw new Error('No JSON in MCP text');
  return JSON.parse(text.slice(first));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
```

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add src/lib/sync/
git commit -m "feat(sync): MCP client with retry/backoff + JSON extraction"
```

---

### Task 3.2: Sync run tracker

**Files:**
- Create: `src/lib/sync/run-tracker.ts`
- Create: `src/lib/sync/run-tracker.test.ts` (integration test with testcontainers)

**Step 1: Contract**

```ts
// src/lib/sync/run-tracker.ts
import { db } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function startRun(source: string): Promise<string> {
  const [row] = await db.insert(syncRuns).values({ source, status: 'running' }).returning({ id: syncRuns.id });
  return row.id;
}

export async function finishRun(id: string, opts: { status: 'success' | 'partial' | 'failed'; rowsWritten?: number; error?: string }) {
  await db.update(syncRuns).set({
    status: opts.status,
    rowsWritten: opts.rowsWritten ?? 0,
    error: opts.error ?? null,
    finishedAt: new Date(),
  }).where(eq(syncRuns.id, id));
}
```

**Step 2: Write integration test using testcontainers**

```ts
// run-tracker.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestDB, type TestDB } from '@/test/db-container';
import { startRun, finishRun } from './run-tracker';

// swap exported db for test DB via vi.doMock — or refactor to pass db explicitly.
// EASIER: refactor run-tracker.ts to accept db, test with the injected db.
```

Refactor `run-tracker.ts` to accept `db` as first arg (testability). Add convenience that uses default import when called without.

**Step 3: Run tests — PASS**

**Step 4: Commit**

```bash
git add src/lib/sync/run-tracker.ts src/lib/sync/run-tracker.test.ts
git commit -m "feat(sync): run tracker with testcontainer-backed tests"
```

---

### Task 3.3: Meta Ads sync fetcher (first MCP platform, MVP)

**Files:**
- Create: `src/lib/sync/meta.ts`
- Create: `src/lib/sync/meta.test.ts`

**Step 1: Read Meta MCP server docs**

Check `https://mcp-meta.up.railway.app/mcp` tool list. From v2 memory: it exposes `list_ads`, `get_insights`, etc. Pick the tool that returns per-campaign per-day insights for an ad account.

Before writing, query the live MCP for its tool list:
```bash
curl -s -X POST https://mcp-meta.up.railway.app/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | jq .
```
Document tool name + param shape in a comment at top of `meta.ts`.

**Step 2: Contract**

```ts
export async function syncMeta(opts: { start: string; end: string; db?: DB }): Promise<{ rowsWritten: number }>
```

Fetches daily insights per campaign for Meta account `act_295812916`, UPSERTs into `ads_daily` with `platform='meta'`.

**Step 3: Write test**

Mock `callMCPTool` → returns fixed insights JSON. Assert: inserts rows with correct shape, upserts on rerun (idempotent).

**Step 4: Implement**

Use Drizzle `onConflictDoUpdate` for the primary key `(date, platform, campaign_id)`.

**Step 5: Run tests — PASS**

**Step 6: Commit**

```bash
git add src/lib/sync/meta.ts src/lib/sync/meta.test.ts
git commit -m "feat(sync): Meta Ads MCP fetcher with upsert"
```

---

### Task 3.4: Google Ads sync fetcher

Same shape as Task 3.3. MCP URL: `https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp`. Customer: `1331139339`. Platform key: `google_ads`.

Files: `src/lib/sync/google-ads.ts`, test file.

TDD same pattern. Commit: `feat(sync): Google Ads MCP fetcher`.

---

### Task 3.5: Criteo sync fetcher

MCP URL: `https://mcp-criteo.up.railway.app/mcp`. Advertiser: `55483`. Platform key: `criteo`.

**Note:** Criteo token expires every 15 min, the MCP server auto-refreshes per memory. No special handling needed in our code.

Files: `src/lib/sync/criteo.ts`, test. Commit: `feat(sync): Criteo MCP fetcher`.

---

### Task 3.6: GA4 sync fetcher

MCP URL: `https://mcp-analytics.up.railway.app/mcp`. Property: `315856757`. Writes to `ga4_daily`.

Fields from design §5.1: `date, channel_group, source, medium, sessions, users, new_users, engaged_sessions, bounce_rate, transactions, revenue, items_viewed, add_to_cart, begin_checkout`.

Files: `src/lib/sync/ga4.ts`, test. Commit: `feat(sync): GA4 MCP fetcher`.

---

### Task 3.7: Pinterest read-from-Windsor adapter

**Files:**
- Create: `src/lib/sync/pinterest.ts`

**Step 1:** Pinterest data arrives via Windsor at `ad_performance_daily`. No fetch needed — just a **read adapter** that normalizes Windsor rows to the same shape as `ads_daily` for the rollup stage. Does NOT write anywhere.

```ts
export async function readPinterestRange(db: DB, range: DateRange) {
  const rows = await db.select().from(adPerformanceDaily)
    .where(and(
      eq(adPerformanceDaily.datasource, 'pinterest'),
      gte(adPerformanceDaily.date, range.start),
      lte(adPerformanceDaily.date, range.end),
    ));
  return rows.map(normalize);
}
```

`normalize` handles: TEXT-cast numeric fields (conversions, conversion_value, ctr, roas), derives COS from ROAS when conversion_value is empty.

**Step 2:** Unit test with fixture data.

**Step 3:** Commit: `feat(sync): Pinterest Windsor adapter with COS-from-ROAS fallback`.

---

### Task 3.8: Cron route `/api/cron/sync`

**Files:**
- Create: `src/app/api/cron/sync/route.ts`

**Step 1: Read Next 16 route handler docs**

Run: `ls node_modules/next/dist/docs/01-app/ | head -30` and read the API routes doc. Next 16 may have changed route handler signatures. Adapt accordingly.

**Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { syncMeta } from '@/lib/sync/meta';
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { buildRollups } from '@/lib/rollup';
import { resolvePeriod } from '@/lib/periods';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== process.env.CRON_SECRET) return new NextResponse('Unauthorized', { status: 401 });

  const range = resolvePeriod('last_7d'); // refresh last 7 days daily (upsert)

  const results = await Promise.allSettled([
    syncMeta(range),
    syncGoogleAds(range),
    syncCriteo(range),
    syncGA4(range),
  ]);

  const summary = results.map((r, i) => ({
    source: ['meta', 'google_ads', 'criteo', 'ga4'][i],
    status: r.status,
    ...(r.status === 'fulfilled' ? { rows: r.value.rowsWritten } : { error: String(r.reason) }),
  }));

  await buildRollups();

  return NextResponse.json({ ok: true, summary });
}
```

**Step 3: Smoke test locally**

Run: `CRON_SECRET=test pnpm dev` then `curl localhost:3000/api/cron/sync?key=test`.
Expected: JSON summary, no 500s. Rows written may be 0 if MCP servers unauthenticated in local env.

**Step 4: Commit**

```bash
git add src/app/api/cron/sync
git commit -m "feat(api): /api/cron/sync orchestrates all MCP syncs + rollups"
```

---

## Phase 4 — Rollup

### Task 4.1: `lib/rollup.ts` — cache builder (TDD)

**Files:**
- Create: `src/lib/rollup.ts`
- Create: `src/lib/rollup.test.ts`

**Step 1: Contract**

```ts
export async function buildRollups(db: DB = defaultDb): Promise<{ cached: number }>
```

For each `(periodKey, platform, compareKey)` tuple, compute payload from `ads_daily` + `ga4_daily` + `ad_performance_daily` (for Pinterest), UPSERT into `dashboard_cache`.

Payload shape:
```ts
type RollupPayload = {
  range: DateRange;
  compareRange: DateRange | null;
  kpis: {
    spend: number; impressions: number; clicks: number; conversions: number;
    conversionValue: number; revenue: number; sessions: number; transactions: number;
    ctr: number; cpc: number; cpm: number; cos: number | null; roas: number | null;
  };
  deltas: Partial<Record<keyof RollupPayload['kpis'], number>>;
  timeSeries: Array<{ date: string; spend: number; revenue: number; sessions: number }>;
  campaigns: Array<{ platform: string; id: string; name: string; spend: number; conversionValue: number; status: string | null; cos: number | null }>;
  warnings: string[]; // e.g. 'pinterest_30d_cap'
};
```

**Step 2: Write tests**

Seed test DB with fixture rows, assert payload shape for `last_7d` × `meta` × `previous_period`. Assert: sums correct, delta computed as `(current - compare) / compare`, warnings array contains `'pinterest_30d_cap'` when periodKey > 30 days.

**Step 3: Implement**

Aggregations via Drizzle SQL. For platforms, loop `['meta', 'google_ads', 'criteo', 'pinterest', 'ga4', 'all']`. Platform `'all'` combines `ads_daily` + Pinterest adapter.

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add src/lib/rollup.ts src/lib/rollup.test.ts
git commit -m "feat(rollup): build dashboard_cache from daily tables"
```

---

## Phase 5 — API routes

### Task 5.1: Shared API helpers

**Files:**
- Create: `src/lib/api.ts` (request parsing, cache lookup)
- Create: `src/lib/api.test.ts`

**Contract:**
```ts
export function parseFilterQuery(req: Request): { period: PeriodKey; compare: CompareKey };
export async function getCached(platform: string, period: PeriodKey, compare: CompareKey): Promise<RollupPayload | null>;
```

Zod validation for query params. Return 400 on invalid. Tests for edge cases.

Commit: `feat(api): parseFilterQuery + getCached helpers`.

---

### Task 5.2: `/api/data/executive-summary`

**Files:**
- Create: `src/app/api/data/executive-summary/route.ts`
- Create: `src/app/api/data/executive-summary/route.test.ts`

```ts
export async function GET(req: Request) {
  const { period, compare } = parseFilterQuery(req);
  const all = await getCached('all', period, compare);
  if (!all) return NextResponse.json({ error: 'no_data' }, { status: 404 });
  const perPlatform = await Promise.all(
    ['meta', 'google_ads', 'criteo', 'pinterest', 'ga4'].map(p => getCached(p, period, compare))
  );
  return NextResponse.json({ all, perPlatform });
}
```

Integration test: seed cache, fetch endpoint, assert shape.

Commit: `feat(api): executive-summary endpoint`.

---

### Tasks 5.3 – 5.11: Remaining 9 data endpoints

One task per tab. Each: route + test. Each route composes specific slices of `dashboard_cache` + raw tables for tab-specific views (e.g. Funnel needs GA4 event sums per step).

Tabs list:
- `performance-marketing`
- `google-ads`
- `meta-ads`
- `pinterest`
- `criteo`
- `product-catalogs`
- `funnel`
- `traffic-sources`
- `top-products`

For each: pattern is the same as 5.2 but with tab-specific data shaping. Keep each commit small.

---

## Phase 6 — Frontend shell

**Apply `@frontend-design` skill starting here for component visuals.** This plan defines component contracts; `frontend-design` handles pixel polish.

### Task 6.1: Tailwind tokens + globals.css

**Files:**
- Modify: `src/app/globals.css`
- Create: `tailwind.config.ts` if not exists (Tailwind 4 inline config alternative)

**Step 1:** Replace `src/app/globals.css` with design tokens from design doc §8.

```css
@import "tailwindcss";

@theme {
  --color-bg-base: #FBFBFD;
  --color-bg-card: #FFFFFF;
  --color-bg-elevated: #F5F5F7;
  --color-border-subtle: #E5E5EA;
  --color-border-strong: #D2D2D7;
  --color-ink-primary: #1D1D1F;
  --color-ink-secondary: #6E6E73;
  --color-ink-tertiary: #86868B;
  --color-accent-positive: #30D158;
  --color-accent-negative: #FF453A;
  --color-accent-warning: #FF9F0A;
  --color-accent-primary: #0071E3;
  --color-chart-1: #C9A79C;
  --color-chart-2: #6A8470;
  --color-chart-3: #0071E3;
  --color-chart-4: #BF8E4C;
  --color-chart-5: #BF5AF2;
  --color-chart-6: #64D2FF;
  --font-display: -apple-system, "SF Pro Display", "Inter", system-ui, sans-serif;
  --font-text: -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08);
}

html, body {
  background: var(--color-bg-base);
  color: var(--color-ink-primary);
  font-family: var(--font-text);
  font-feature-settings: "tnum";
  -webkit-font-smoothing: antialiased;
}

.numeric { font-feature-settings: "tnum" 1; }
```

**Step 2:** Run `pnpm build` to confirm Tailwind 4 picks up the tokens.

**Step 3:** Commit: `feat(design): Apple Keynote design tokens`.

---

### Task 6.2: Zustand store + SWR provider

**Files:**
- Create: `src/stores/filters.ts`
- Create: `src/components/providers.tsx`
- Modify: `src/app/layout.tsx`

```ts
// stores/filters.ts
import { create } from 'zustand';
import type { PeriodKey, CompareKey } from '@/lib/periods';

type FiltersState = {
  period: PeriodKey;
  compare: CompareKey;
  setPeriod: (p: PeriodKey) => void;
  setCompare: (c: CompareKey) => void;
};

export const useFilters = create<FiltersState>((set) => ({
  period: 'last_30d',
  compare: 'previous_period',
  setPeriod: (period) => set({ period }),
  setCompare: (compare) => set({ compare }),
}));
```

`providers.tsx` wraps SWRConfig with global fetcher + error retry. Sync filters state to URL hash.

Commit: `feat(shell): filter store + SWR provider`.

---

### Task 6.3: shadcn/ui init + primitives needed

Run: `pnpm dlx shadcn@latest init` (accept Tailwind 4 config, path `@/components/ui`).

Add components:
```bash
pnpm dlx shadcn@latest add button select popover calendar badge alert skeleton
```

Commit: `chore: shadcn/ui primitives`.

---

### Task 6.4: `<FilterBar />` component

**Files:**
- Create: `src/components/shell/FilterBar.tsx`
- Create: `src/components/shell/FilterBar.stories.mdx` OR simple snapshot test in `src/tests/e2e/filter-bar.spec.ts`

**Contract:**
- Two shadcn `Select`s: period preset + compare mode
- Custom range → shadcn `Popover` with `Calendar` (range mode)
- Shows resolved date range under each select (via `formatDateRangePL`)
- Writes to Zustand store, mirrors to URL hash

Reference design doc §5 and §8 for UX spec. Hand off visual polish to `frontend-design` skill.

Commit: `feat(shell): FilterBar with period + compare selectors`.

---

### Task 6.5: `<Header />` + `<TabNav />` + `<DashboardShell />`

**Files:**
- Create: `src/components/shell/Header.tsx`
- Create: `src/components/shell/TabNav.tsx`
- Create: `src/components/shell/DashboardShell.tsx`
- Modify: `src/app/page.tsx` to render `<DashboardShell />`

**Contract:**
- Header: logo (from `public/brand/room99-logo.png`), title "Performance Dashboard", FilterBar on right, sticky with backdrop blur on scroll >20px
- TabNav: 10 tab pills, keyboard nav, active state, sync to URL hash
- DashboardShell: layout wrapper; renders active tab component

Commit: `feat(shell): Header + TabNav + DashboardShell`.

---

## Phase 7 — Primitives

### Task 7.1: `<HeroMetric />`

**Files:**
- Create: `src/components/primitives/HeroMetric.tsx`
- Create: `src/components/primitives/HeroMetric.test.tsx` (React Testing Library)

**Props:**
```ts
type HeroMetricProps = {
  label: string;
  value: number | null;
  format: 'pln' | 'int' | 'pct';
  delta?: number | null;
  tooltip?: string;
};
```

Renders 72px/700 numeric (via formatters from §8), label small-caps above, delta badge below. Framer Motion count-up on value change.

Commit: `feat(ui): HeroMetric with count-up animation`.

---

### Task 7.2: `<ScoreCard />`

28-32px numeric, label, optional delta. Similar to HeroMetric but smaller. Commit: `feat(ui): ScoreCard`.

---

### Task 7.3: `<DeltaBadge />`

Uses `formatDelta`. Tailwind classes for positive (`text-accent-positive`) / negative / neutral. Commit: `feat(ui): DeltaBadge`.

---

### Task 7.4: Chart primitives (ChartLine, ChartBar, ChartPie)

Recharts wrappers with house styling: muted grid, tabular nums in tooltips, `--color-chart-*` palette. Props: `data: Array<{x: string | number, y: number}>`, `series: Array<{key, label}>`. Commit: `feat(ui): chart primitives`.

---

### Task 7.5: `<DataTable />` with TanStack Table

Sticky header, sortable columns, pagination (50/page), sticky first column for campaign name. Supports row-level formatting via column definition. Commit: `feat(ui): DataTable`.

---

### Task 7.6: `<EmptyState />`

Used when platform missing data (e.g., Criteo unreachable). Shows icon + label + optional retry button. Commit: `feat(ui): EmptyState`.

---

## Phase 8 — Tabs

**Hand off visual composition to `@frontend-design` with the contract below.**

### Task 8.1: `<ExecutiveSummary />` (MVP tab #1)

**Data fetch:**
```ts
const { data, error, isLoading } = useSWR(`/api/data/executive-summary?period=${period}&compare=${compare}`);
```

**Layout (per design §7.1 + §7.2):**
- Hero: Revenue, Spend, COS
- Chart: Revenue vs Spend line chart (daily) — dual axis
- Scorecards (4): Sessions, Transactions, AOV, ROAS
- Table: per-platform breakdown (spend / conversions / revenue / COS)

Commit: `feat(tab): Executive Summary`.

---

### Task 8.2: `<MetaAds />` (MVP tab #2)

Per design §7.2. Account `act_295812916`. Shows campaigns from `ads_daily WHERE platform='meta'`.

Commit: `feat(tab): Meta Ads`.

---

### Task 8.3: `<GoogleAds />`

Per design §7.2. Customer `1331139339`.

Commit: `feat(tab): Google Ads`.

---

### Task 8.4: `<Pinterest />`

Per design §7.2. **Includes `<Badge variant="warning">Pinterest: ograniczone do 30d (czeka na API)</Badge>`** when `resolvePeriod` yields range > 30 days. Data source: `ad_performance_daily`.

Commit: `feat(tab): Pinterest with 30d guard`.

---

### Task 8.5: `<Criteo />`

Per design §7.2. Advertiser `55483`.

Commit: `feat(tab): Criteo`.

---

### Task 8.6: `<PerformanceMarketing />`

Cross-platform view. Uses `platform='all'` cache. Campaign list merged from all platforms. Commit: `feat(tab): Performance Marketing cross-platform`.

---

### Task 8.7: `<ProductCatalogs />`

Catalog-focused view. Needs `campaign_objective` filtering for catalog campaigns (Meta Advantage+, Google Shopping, Pinterest Catalog). Commit: `feat(tab): Product Catalogs`.

---

### Task 8.8: `<Funnel />`

GA4 event funnel: sessions → items_viewed → add_to_cart → begin_checkout → transactions. Bar chart with drop-off %. Commit: `feat(tab): Funnel`.

---

### Task 8.9: `<TrafficSources />`

From `ga4_daily`. Group by `channel_group`. Stacked bar + pie. Commit: `feat(tab): Traffic Sources`.

---

### Task 8.10: `<TopProducts />`

**Data gap:** product-level data needs `items` dimension from GA4. Extend `syncGA4` fetcher with a second call that fetches `itemName, itemRevenue, itemsPurchased` dimension-metric pairs. Add `ga4_items_daily` table. Build this in Task 8.10.0 BEFORE the tab. Commit: `feat(tab): Top Products + GA4 items sync`.

---

## Phase 9 — QA + deploy

### Task 9.1: E2E smoke test

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('dashboard loads, tabs switch, date picker updates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Performance Dashboard')).toBeVisible();
  // switch tabs
  for (const hash of ['meta-ads', 'google-ads', 'pinterest']) {
    await page.click(`[data-tab="${hash}"]`);
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
  }
  // change period
  await page.click('[data-filter="period"]');
  await page.click('text=Ostatnie 7 dni');
  await expect(page.locator('[data-metric="spend"]')).toBeVisible();
});
```

Commit: `test(e2e): dashboard smoke test`.

---

### Task 9.2: Visual regression snapshots

**Files:**
- Create: `tests/e2e/visual.spec.ts`

Screenshot per tab × 2 presets (last_7d, last_30d). Commit: `test(e2e): visual regression snapshots`.

---

### Task 9.3: Sentry wiring

Run: `pnpm dlx @sentry/wizard@latest -i nextjs`. Follow prompts. Configure `SENTRY_DSN` in `.env` and Railway env. Commit: `chore: Sentry error tracking`.

---

### Task 9.4: Railway deployment config

**Files:**
- Create: `railway.json`
- Create: `Dockerfile` (optional — Railway Nixpacks works without, but Dockerfile gives us control)
- Create: `.env.example` (committed, documents required env vars)

`railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "pnpm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Create `/api/health/route.ts` returning `{ok: true}` + DB ping.

Commit: `chore: Railway deploy config + healthcheck`.

---

### Task 9.5: Railway env vars + cron setup

**Manual steps (Marcin executes via Railway dashboard):**

1. Railway → `room99-dashboard-sync` → Add new service → from GitHub `marketinghacker/room99-dashboard-analytics`
2. Set env vars (from design §11.1)
3. Generate public domain
4. Settings → Cron Schedule → `*/30 * * * *` → `GET /api/cron/sync?key=$CRON_SECRET`
5. Deploy → verify logs → hit public URL
6. Smoke check: open dashboard, verify data loads

Document steps in `docs/plans/2026-04-16-dashboard-v3-deploy-runbook.md` — Marcin keeps this as ops reference.

Commit: `docs: Railway deployment runbook`.

---

### Task 9.6: Decommission old services

After 48h of stable prod:
1. Delete old `sync-worker` Railway service
2. Delete Vercel project `room99-dashboard-analytics`
3. Remove Neon DB references from any docs
4. Remove `.dashboard-config.json` from repo if present (has API key, should not be committed)

Commit: `chore: decommission v2 infrastructure`.

---

## Done when

- [ ] All 10 tabs render real data from Railway Postgres
- [ ] Date picker changes refresh all tabs in <500ms (SWR cache hit)
- [ ] Pinterest badge shows on periods > 30 days
- [ ] Sync cron writes sync_runs entry every 30 min, visible in `/admin/sync-log`
- [ ] Playwright smoke test passes
- [ ] Sentry receives at least one test event
- [ ] Klient Room99 otwiera URL, widzi premium light-mode dashboard z ich brand wordmarkiem, liczby się zgadzają z Meta/Google/Criteo panelami

## Skills chain

- `@superpowers:test-driven-development` — Phases 2, 4 (lib code)
- `@superpowers:executing-plans` — whole plan
- `@frontend-design` — Phases 6–8 (visual polish)
- `@data:build-dashboard` — if we want interactive Recharts enrichment beyond our wrappers
- `@superpowers:verification-before-completion` — before marking any phase "done"
- `@superpowers:requesting-code-review` — before merging major phases (1, 3, 8)
