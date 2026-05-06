# Sales Tree + XLSX/CSV Export — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 4-level drill-down tree (Channel → Category → Collection → Product) with sparklines, period comparison, search, top-N collapse, and XLSX/CSV export — using existing `products_daily` Postgres table.

**Architecture:**
- **Backend**: One CTE-based SQL query in a new API route returns a hierarchical JSON; a sibling export route streams XLSX (`exceljs`, hierarchical with outline groups) or CSV (flat).
- **Frontend**: New `SalesTree` tab with virtualized tree (`@tanstack/react-virtual`), Fuse.js fuzzy search, sparkline SVG component, modal for export.
- **Data flow**: User picks period → tab calls `/api/data/sales-tree?start=…&end=…` → renders tree → user clicks Export → modal posts to `/api/data/sales-tree/export?format=xlsx|csv` → browser downloads file.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, Postgres (Neon-on-Railway), `exceljs`, `fuse.js`, `@tanstack/react-virtual`, Vitest.

**Reference:** Design doc at `docs/plans/2026-05-06-sales-tree-export-design.md` (commit `feat: design sales tree export`).

---

## Task ordering rationale

Backend before frontend. Each task is independently testable and committable. Database query first because the rest depends on its shape. Export endpoints last (reuse tree-builder logic).

```
Task 1: Install deps
Task 2: Tree-builder pure function + unit test (no DB)
Task 3: SQL aggregator + integration test (real DB, real data)
Task 4: GET /api/data/sales-tree route
Task 5: Sparkline component + test
Task 6: SalesTreeRow component + test
Task 7: SalesTree container + virtualization
Task 8: Wire into DashboardShell as new tab
Task 9: Search (Fuse.js) — adds filtering on top of tree
Task 10: Top-N collapse logic
Task 11: ExportModal component
Task 12: GET /api/data/sales-tree/export?format=csv (simpler, do first)
Task 13: GET /api/data/sales-tree/export?format=xlsx
Task 14: Hook export button → modal → download
Task 15: End-to-end smoke test + deploy
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add deps**

Run:
```bash
pnpm add exceljs fuse.js @tanstack/react-virtual
```

**Step 2: Verify install**

Run: `pnpm list exceljs fuse.js @tanstack/react-virtual`
Expected: all three listed with versions.

**Step 3: TypeScript check**

Run: `pnpm tsc --noEmit 2>&1 | head -5`
Expected: clean (no new errors).

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): add exceljs, fuse.js, react-virtual for sales tree"
```

---

## Task 2: Tree-builder pure function + unit test

The tree builder takes flat rows from SQL and assembles the 4-level nested structure. Pure function — no DB, no React. Lives in `src/lib/sales-tree.ts`.

**Files:**
- Create: `src/lib/sales-tree.ts`
- Create: `src/lib/sales-tree.test.ts`

**Step 1: Write failing test**

`src/lib/sales-tree.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSalesTree, type FlatRow } from './sales-tree';

describe('buildSalesTree', () => {
  const rows: FlatRow[] = [
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'SKU1',
      product_name: 'Narzuta Molly Krem', revenue: 100, quantity: 2, orders: 1,
      revenue_prev: 80, daily: [10, 20, 30, 40] },
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'SKU2',
      product_name: 'Narzuta Molly Szara', revenue: 50, quantity: 1, orders: 1,
      revenue_prev: 60, daily: [5, 10, 15, 20] },
    { source: 'allegro', category: 'FIRANA', collection: 'NOELLE', sku: 'SKU3',
      product_name: 'Firana Noelle', revenue: 200, quantity: 4, orders: 2,
      revenue_prev: 150, daily: [50, 50, 50, 50] },
  ];

  it('groups by source → category → collection → product', () => {
    const tree = buildSalesTree(rows);
    expect(tree).toHaveLength(2); // shr + allegro
    const shr = tree.find(c => c.source === 'shr')!;
    expect(shr.metrics.revenue).toBe(150); // 100 + 50
    expect(shr.categories).toHaveLength(1);
    expect(shr.categories[0].collections[0].products).toHaveLength(2);
  });

  it('sums daily arrays element-wise for each level', () => {
    const tree = buildSalesTree(rows);
    const shrCollection = tree[0].categories[0].collections[0];
    expect(shrCollection.daily).toEqual([15, 30, 45, 60]); // 10+5, 20+10, ...
  });

  it('calculates change % vs prev period', () => {
    const tree = buildSalesTree(rows);
    const shrProduct = tree.find(c => c.source === 'shr')!.categories[0].collections[0].products[0];
    expect(shrProduct.metrics.change).toBeCloseTo(25); // (100-80)/80 = 25%
  });

  it('returns empty array for empty input', () => {
    expect(buildSalesTree([])).toEqual([]);
  });

  it('sorts every level by revenue descending', () => {
    const tree = buildSalesTree(rows);
    const allegro = tree.find(c => c.source === 'allegro')!;
    const shr = tree.find(c => c.source === 'shr')!;
    expect(tree[0].source).toBe('allegro'); // 200 > 150
    expect(shr.categories[0].collections[0].products[0].sku).toBe('SKU1'); // 100 > 50
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/sales-tree.test.ts`
Expected: FAIL — "Cannot find module './sales-tree'"

**Step 3: Implement**

`src/lib/sales-tree.ts`:
```ts
export type FlatRow = {
  source: string;
  category: string;
  collection: string;
  sku: string;
  product_name: string;
  revenue: number;
  quantity: number;
  orders: number;
  revenue_prev: number;
  daily: number[]; // daily revenue, length = period days
};

export type Metrics = {
  revenue: number;
  quantity: number;
  orders: number;
  revenuePrev: number;
  change: number; // % vs prev
};

export type ProductNode = { sku: string; name: string; metrics: Metrics; daily: number[] };
export type CollectionNode = { collection: string; metrics: Metrics; daily: number[]; products: ProductNode[] };
export type CategoryNode = { category: string; metrics: Metrics; daily: number[]; collections: CollectionNode[] };
export type ChannelNode = { source: string; metrics: Metrics; daily: number[]; categories: CategoryNode[] };

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function sumDaily(arrays: number[][]): number[] {
  if (arrays.length === 0) return [];
  const len = Math.max(...arrays.map(a => a.length));
  const out = new Array(len).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) out[i] += arr[i];
  }
  return out;
}

export function buildSalesTree(rows: FlatRow[]): ChannelNode[] {
  // Group rows by source → category → collection
  const channelMap = new Map<string, Map<string, Map<string, FlatRow[]>>>();
  for (const r of rows) {
    if (!channelMap.has(r.source)) channelMap.set(r.source, new Map());
    const cat = channelMap.get(r.source)!;
    if (!cat.has(r.category)) cat.set(r.category, new Map());
    const col = cat.get(r.category)!;
    if (!col.has(r.collection)) col.set(r.collection, []);
    col.get(r.collection)!.push(r);
  }

  const channels: ChannelNode[] = [];
  for (const [source, catMap] of channelMap) {
    const categories: CategoryNode[] = [];
    for (const [category, colMap] of catMap) {
      const collections: CollectionNode[] = [];
      for (const [collection, productRows] of colMap) {
        const products: ProductNode[] = productRows.map(r => ({
          sku: r.sku,
          name: r.product_name,
          daily: r.daily,
          metrics: {
            revenue: r.revenue, quantity: r.quantity, orders: r.orders,
            revenuePrev: r.revenue_prev, change: pctChange(r.revenue, r.revenue_prev),
          },
        }));
        products.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
        const colRev = products.reduce((s, p) => s + p.metrics.revenue, 0);
        const colPrev = products.reduce((s, p) => s + p.metrics.revenuePrev, 0);
        collections.push({
          collection, products, daily: sumDaily(products.map(p => p.daily)),
          metrics: {
            revenue: colRev,
            quantity: products.reduce((s, p) => s + p.metrics.quantity, 0),
            orders: products.reduce((s, p) => s + p.metrics.orders, 0),
            revenuePrev: colPrev, change: pctChange(colRev, colPrev),
          },
        });
      }
      collections.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
      const catRev = collections.reduce((s, c) => s + c.metrics.revenue, 0);
      const catPrev = collections.reduce((s, c) => s + c.metrics.revenuePrev, 0);
      categories.push({
        category, collections, daily: sumDaily(collections.map(c => c.daily)),
        metrics: {
          revenue: catRev,
          quantity: collections.reduce((s, c) => s + c.metrics.quantity, 0),
          orders: collections.reduce((s, c) => s + c.metrics.orders, 0),
          revenuePrev: catPrev, change: pctChange(catRev, catPrev),
        },
      });
    }
    categories.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
    const chRev = categories.reduce((s, c) => s + c.metrics.revenue, 0);
    const chPrev = categories.reduce((s, c) => s + c.metrics.revenuePrev, 0);
    channels.push({
      source, categories, daily: sumDaily(categories.map(c => c.daily)),
      metrics: {
        revenue: chRev,
        quantity: categories.reduce((s, c) => s + c.metrics.quantity, 0),
        orders: categories.reduce((s, c) => s + c.metrics.orders, 0),
        revenuePrev: chPrev, change: pctChange(chRev, chPrev),
      },
    });
  }
  channels.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  return channels;
}
```

**Step 4: Run tests pass**

Run: `pnpm vitest run src/lib/sales-tree.test.ts`
Expected: 5 passing.

**Step 5: Commit**

```bash
git add src/lib/sales-tree.ts src/lib/sales-tree.test.ts
git commit -m "feat(sales-tree): pure tree builder with daily sums + change %"
```

---

## Task 3: SQL aggregator + integration test

Aggregator pulls from `products_daily` with CTEs. Returns `FlatRow[]` matching the tree-builder input. Integration test against real DB (Railway public proxy URL from `.env.local`).

**Files:**
- Create: `src/lib/sales-tree-query.ts`
- Create: `src/lib/sales-tree-query.test.ts`

**Step 1: Write failing test**

`src/lib/sales-tree-query.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { fetchSalesTreeRows } from './sales-tree-query';
import { db } from './db';

describe('fetchSalesTreeRows', () => {
  // Skip if no DB configured (CI)
  const hasDb = !!process.env.DATABASE_URL;
  const t = hasDb ? it : it.skip;

  t('returns flat rows with daily arrays for known period', async () => {
    const rows = await fetchSalesTreeRows({
      start: '2026-04-01', end: '2026-04-15',
      compareStart: '2026-03-17', compareEnd: '2026-03-31',
      channels: ['shr', 'allegro'],
    });
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      const r = rows[0];
      expect(typeof r.source).toBe('string');
      expect(['shr', 'allegro']).toContain(r.source);
      expect(typeof r.product_name).toBe('string');
      expect(typeof r.revenue).toBe('number');
      expect(Array.isArray(r.daily)).toBe(true);
      expect(r.daily.length).toBe(15); // Apr 1..15 = 15 days
    }
  });

  t('excludes "all" pseudo-source', async () => {
    const rows = await fetchSalesTreeRows({
      start: '2026-04-01', end: '2026-04-15',
      compareStart: '2026-03-17', compareEnd: '2026-03-31',
      channels: ['shr', 'allegro'],
    });
    expect(rows.every(r => r.source !== 'all')).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/sales-tree-query.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement**

`src/lib/sales-tree-query.ts`:
```ts
import { db } from './db';
import { sql } from 'drizzle-orm';
import type { FlatRow } from './sales-tree';

export type FetchOptions = {
  start: string; end: string;
  compareStart: string; compareEnd: string;
  channels: string[]; // e.g. ['shr', 'allegro']
};

export async function fetchSalesTreeRows(opts: FetchOptions): Promise<FlatRow[]> {
  // Generate date series for current period; pad missing days with 0.
  const channelList = opts.channels.length > 0 ? opts.channels : ['shr', 'allegro'];

  const result = await db.execute(sql`
    WITH dates AS (
      SELECT generate_series(
        ${opts.start}::date,
        ${opts.end}::date,
        '1 day'::interval
      )::date AS d
    ),
    keys AS (
      SELECT DISTINCT source, category, collection, sku, product_name
      FROM products_daily
      WHERE source = ANY(${channelList}::text[])
        AND ((date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.start}::date AND ${opts.end}::date
          OR (date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.compareStart}::date AND ${opts.compareEnd}::date)
    ),
    current_daily AS (
      SELECT k.source, k.category, k.collection, k.sku, k.product_name, d.d AS day,
             COALESCE(SUM(p.revenue::numeric), 0)::float8 AS revenue,
             COALESCE(SUM(p.quantity), 0)::int AS quantity,
             COALESCE(SUM(p.orders), 0)::int AS orders
      FROM keys k
      CROSS JOIN dates d
      LEFT JOIN products_daily p
        ON p.source = k.source AND p.sku = k.sku
        AND (p.date AT TIME ZONE 'Europe/Warsaw')::date = d.d
      GROUP BY k.source, k.category, k.collection, k.sku, k.product_name, d.d
    ),
    current_agg AS (
      SELECT source, category, collection, sku, product_name,
             SUM(revenue) AS revenue,
             SUM(quantity) AS quantity,
             SUM(orders) AS orders,
             ARRAY_AGG(revenue ORDER BY day) AS daily
      FROM current_daily
      GROUP BY source, category, collection, sku, product_name
    ),
    prev_agg AS (
      SELECT source, sku,
             COALESCE(SUM(revenue::numeric), 0)::float8 AS revenue_prev
      FROM products_daily
      WHERE source = ANY(${channelList}::text[])
        AND (date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.compareStart}::date AND ${opts.compareEnd}::date
      GROUP BY source, sku
    )
    SELECT
      c.source, c.category, c.collection, c.sku, c.product_name,
      c.revenue, c.quantity, c.orders, c.daily,
      COALESCE(p.revenue_prev, 0) AS revenue_prev
    FROM current_agg c
    LEFT JOIN prev_agg p ON p.source = c.source AND p.sku = c.sku
    WHERE c.revenue > 0 OR p.revenue_prev > 0
  `);

  // Drizzle returns { rows: any[] }
  type Row = {
    source: string; category: string; collection: string; sku: string; product_name: string;
    revenue: string | number; quantity: number; orders: number;
    daily: number[]; revenue_prev: string | number;
  };
  const raw = (result as unknown as { rows: Row[] }).rows;
  return raw.map(r => ({
    source: r.source,
    category: r.category ?? 'BEZ KATEGORII',
    collection: r.collection ?? 'BEZ KOLEKCJI',
    sku: r.sku,
    product_name: r.product_name ?? r.sku,
    revenue: Number(r.revenue),
    quantity: Number(r.quantity),
    orders: Number(r.orders),
    revenue_prev: Number(r.revenue_prev),
    daily: (r.daily ?? []).map(Number),
  }));
}
```

**Step 4: Verify with real DB**

Run: `DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) pnpm vitest run src/lib/sales-tree-query.test.ts`
Expected: tests pass with real rows.

**Step 5: Commit**

```bash
git add src/lib/sales-tree-query.ts src/lib/sales-tree-query.test.ts
git commit -m "feat(sales-tree): SQL aggregator with daily sparkline arrays"
```

---

## Task 4: GET /api/data/sales-tree route

Wires query → tree builder → JSON response. Includes period validation and basic error handling.

**Files:**
- Create: `src/app/api/data/sales-tree/route.ts`
- Create: `src/app/api/data/sales-tree/route.test.ts`

**Step 1: Write failing test**

`src/app/api/data/sales-tree/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/sales-tree-query', () => ({
  fetchSalesTreeRows: vi.fn().mockResolvedValue([
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'A',
      product_name: 'A name', revenue: 100, quantity: 1, orders: 1,
      revenue_prev: 80, daily: [50, 50] },
  ]),
}));

describe('GET /api/data/sales-tree', () => {
  it('returns 400 when start/end missing', async () => {
    const req = new Request('http://x/api/data/sales-tree');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns tree structure for valid request', async () => {
    const req = new Request('http://x/api/data/sales-tree?start=2026-04-01&end=2026-04-02');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].source).toBe('shr');
    expect(body.channels[0].metrics.revenue).toBe(100);
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm vitest run src/app/api/data/sales-tree/route.test.ts`
Expected: FAIL.

**Step 3: Implement**

`src/app/api/data/sales-tree/route.ts`:
```ts
import { fetchSalesTreeRows } from '@/lib/sales-tree-query';
import { buildSalesTree } from '@/lib/sales-tree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shiftPrevPeriod(start: string, end: string): { compareStart: string; compareEnd: string } {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const compareEnd = new Date(s.getTime() - 86400000);
  const compareStart = new Date(compareEnd.getTime() - (days - 1) * 86400000);
  return {
    compareStart: compareStart.toISOString().slice(0, 10),
    compareEnd: compareEnd.toISOString().slice(0, 10),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) {
    return Response.json({ error: 'start and end query params required (YYYY-MM-DD)' }, { status: 400 });
  }
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['shr', 'allegro'];

  const compStart = url.searchParams.get('compareStart');
  const compEnd = url.searchParams.get('compareEnd');
  const { compareStart, compareEnd } = compStart && compEnd
    ? { compareStart: compStart, compareEnd: compEnd }
    : shiftPrevPeriod(start, end);

  try {
    const rows = await fetchSalesTreeRows({ start, end, compareStart, compareEnd, channels });
    const channelsTree = buildSalesTree(rows);
    return Response.json({
      channels: channelsTree,
      period: { start, end },
      compare: { start: compareStart, end: compareEnd },
      count: rows.length,
    });
  } catch (err) {
    console.error('sales-tree route error', err);
    return Response.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
```

**Step 4: Tests pass**

Run: `pnpm vitest run src/app/api/data/sales-tree/route.test.ts`
Expected: 2 passing.

**Step 5: Commit**

```bash
git add src/app/api/data/sales-tree/route.ts src/app/api/data/sales-tree/route.test.ts
git commit -m "feat(sales-tree): GET /api/data/sales-tree with period comparison"
```

---

## Task 5: Sparkline component + test

Stateless SVG that takes `daily: number[]` and renders a 16×40px line. Color (sage/terracotta) reflects trend. Pure component, memoized.

**Files:**
- Create: `src/components/charts/Sparkline.tsx`
- Create: `src/components/charts/Sparkline.test.tsx`

**Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders SVG with polyline for non-empty data', () => {
    const { container } = render(<Sparkline daily={[1, 5, 3, 8, 4]} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('renders nothing for empty data', () => {
    const { container } = render(<Sparkline daily={[]} />);
    expect(container.querySelector('polyline')).toBeFalsy();
  });

  it('uses sage stroke when trend is up', () => {
    const { container } = render(<Sparkline daily={[1, 2, 3, 4]} />);
    const line = container.querySelector('polyline')!;
    expect(line.getAttribute('stroke')).toBe('var(--color-accent-positive)');
  });

  it('uses terracotta stroke when trend is down', () => {
    const { container } = render(<Sparkline daily={[5, 4, 3, 2]} />);
    const line = container.querySelector('polyline')!;
    expect(line.getAttribute('stroke')).toBe('var(--color-accent-negative)');
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/charts/Sparkline.test.tsx`
Expected: FAIL.

**Step 3: Implement**

```tsx
import { memo } from 'react';

export const Sparkline = memo(function Sparkline({
  daily, width = 56, height = 18,
}: { daily: number[]; width?: number; height?: number }) {
  if (daily.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...daily, 1);
  const min = Math.min(...daily, 0);
  const range = max - min || 1;
  const stepX = width / (daily.length - 1);
  const points = daily
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  // Trend: compare first half avg vs second half avg
  const mid = Math.floor(daily.length / 2);
  const firstAvg = daily.slice(0, mid).reduce((a, b) => a + b, 0) / Math.max(mid, 1);
  const secondAvg = daily.slice(mid).reduce((a, b) => a + b, 0) / Math.max(daily.length - mid, 1);
  const trendUp = secondAvg >= firstAvg;
  const stroke = trendUp ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)';

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.25}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});
```

**Step 4: Tests pass**

Run: `pnpm vitest run src/components/charts/Sparkline.test.tsx`
Expected: 4 passing.

**Step 5: Commit**

```bash
git add src/components/charts/Sparkline.tsx src/components/charts/Sparkline.test.tsx
git commit -m "feat(sales-tree): Sparkline SVG with sage/terracotta trend color"
```

---

## Task 6: SalesTreeRow component + test

Single tree row. Takes node + depth + expanded state + sort context. Uses `Sparkline`. Pure visual.

**Files:**
- Create: `src/components/tabs/sales-tree/SalesTreeRow.tsx`
- Create: `src/components/tabs/sales-tree/SalesTreeRow.test.tsx`

**Step 1: Test (key behaviors only — don't overfit on markup)**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SalesTreeRow } from './SalesTreeRow';

const baseNode = {
  label: 'NARZUTA',
  depth: 1,
  metrics: { revenue: 1234.56, quantity: 5, orders: 3, revenuePrev: 1000, change: 23.456 },
  daily: [10, 20, 30],
  hasChildren: true,
  expanded: false,
};

describe('SalesTreeRow', () => {
  it('renders label, formatted PLN, and quantity', () => {
    render(<SalesTreeRow {...baseNode} onToggle={() => {}} />);
    expect(screen.getByText('NARZUTA')).toBeTruthy();
    expect(screen.getByText(/1\s?234[,.]56/)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('calls onToggle when expand caret clicked', () => {
    const onToggle = vi.fn();
    render(<SalesTreeRow {...baseNode} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('omits caret when no children', () => {
    render(<SalesTreeRow {...baseNode} hasChildren={false} onToggle={() => {}} />);
    expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
  });

  it('shows positive change with sage color', () => {
    const { container } = render(<SalesTreeRow {...baseNode} onToggle={() => {}} />);
    const change = container.querySelector('[data-change]');
    expect(change?.getAttribute('data-change')).toBe('positive');
  });
});
```

**Step 2 + 3: Run failing, then implement**

`src/components/tabs/sales-tree/SalesTreeRow.tsx`:
```tsx
import { Sparkline } from '@/components/charts/Sparkline';

const fmtPLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const fmtInt = new Intl.NumberFormat('pl-PL');

export type SalesTreeRowProps = {
  label: string;
  sublabel?: string; // SKU for product rows
  depth: number; // 0 = channel, 1 = category, 2 = collection, 3 = product
  metrics: { revenue: number; quantity: number; orders: number; revenuePrev: number; change: number };
  daily: number[];
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
};

export function SalesTreeRow(p: SalesTreeRowProps) {
  const { depth, metrics, hasChildren, expanded } = p;
  const indent = depth * 20;
  const changeSign = metrics.change > 0.5 ? 'positive' : metrics.change < -0.5 ? 'negative' : 'neutral';
  const isLeaf = !hasChildren;

  return (
    <div
      className="grid items-center px-3 border-b border-line-soft hover:bg-bg-elevated"
      style={{
        gridTemplateColumns: `minmax(280px, 1fr) 56px 80px 80px 110px 80px`,
        paddingLeft: 12 + indent,
        height: isLeaf ? 32 : 40,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? 'collapse' : 'expand'}
            onClick={p.onToggle}
            className="w-4 h-4 flex items-center justify-center text-ink-tertiary hover:text-ink-primary"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className={`truncate ${depth === 0 ? 'font-semibold' : depth === 3 ? 'text-[13px]' : ''}`}>
          {p.label}
        </span>
        {p.sublabel && <span className="text-[11px] text-ink-tertiary ml-2 shrink-0">{p.sublabel}</span>}
      </div>
      <Sparkline daily={p.daily} />
      <div className="text-right tabular text-[13px]">{fmtInt.format(metrics.quantity)}</div>
      <div className="text-right tabular text-[13px]">{fmtInt.format(metrics.orders)}</div>
      <div className="text-right tabular text-[13px] font-medium">{fmtPLN.format(metrics.revenue)}</div>
      <div
        className={`text-right tabular text-[12px] ${
          changeSign === 'positive' ? 'text-accent-positive'
          : changeSign === 'negative' ? 'text-accent-negative'
          : 'text-ink-tertiary'
        }`}
        data-change={changeSign}
      >
        {metrics.change > 0 ? '+' : ''}{metrics.change.toFixed(1)}%
      </div>
    </div>
  );
}
```

**Step 4: Tests pass**

Run: `pnpm vitest run src/components/tabs/sales-tree/SalesTreeRow.test.tsx`
Expected: 4 passing.

**Step 5: Commit**

```bash
git add src/components/tabs/sales-tree/
git commit -m "feat(sales-tree): SalesTreeRow with sparkline + change indicator"
```

---

## Task 7: SalesTree container with virtualization

Flattens the tree into a visible-rows list (respecting expand state) and feeds `@tanstack/react-virtual`.

**Files:**
- Create: `src/components/tabs/sales-tree/SalesTree.tsx`
- Create: `src/components/tabs/sales-tree/flatten-tree.ts`
- Create: `src/components/tabs/sales-tree/flatten-tree.test.ts`

**Step 1: Test for flatten-tree**

```ts
import { describe, it, expect } from 'vitest';
import { flattenTree } from './flatten-tree';

const sample = [
  {
    source: 'shr',
    metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
    daily: [], categories: [
      { category: 'NARZUTA', metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
        daily: [], collections: [
          { collection: 'MOLLY', metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
            daily: [], products: [{ sku: 'A', name: 'A name', daily: [], metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 } }] }
        ] }
    ]
  }
];

describe('flattenTree', () => {
  it('returns only roots when no nodes expanded', () => {
    const out = flattenTree(sample, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].depth).toBe(0);
  });

  it('expands one level when channel is in expanded set', () => {
    const out = flattenTree(sample, new Set(['shr']));
    expect(out).toHaveLength(2); // channel + category
  });

  it('shows full path when all expanded', () => {
    const expanded = new Set(['shr', 'shr|NARZUTA', 'shr|NARZUTA|MOLLY']);
    const out = flattenTree(sample, expanded);
    expect(out).toHaveLength(4);
    expect(out[3].label).toBe('A name');
  });
});
```

**Step 2: Implement `flatten-tree.ts`**

```ts
import type { ChannelNode } from '@/lib/sales-tree';

export type VisibleRow = {
  id: string; // unique key for expand-state + react key
  label: string;
  sublabel?: string;
  depth: number;
  metrics: ChannelNode['metrics'];
  daily: number[];
  hasChildren: boolean;
  expanded: boolean;
};

export function flattenTree(channels: ChannelNode[], expanded: Set<string>): VisibleRow[] {
  const out: VisibleRow[] = [];
  for (const ch of channels) {
    const chId = ch.source;
    const chExpanded = expanded.has(chId);
    out.push({
      id: chId, label: chLabel(ch.source), depth: 0,
      metrics: ch.metrics, daily: ch.daily,
      hasChildren: ch.categories.length > 0, expanded: chExpanded,
    });
    if (!chExpanded) continue;
    for (const cat of ch.categories) {
      const catId = `${chId}|${cat.category}`;
      const catExpanded = expanded.has(catId);
      out.push({
        id: catId, label: cat.category, depth: 1,
        metrics: cat.metrics, daily: cat.daily,
        hasChildren: cat.collections.length > 0, expanded: catExpanded,
      });
      if (!catExpanded) continue;
      for (const col of cat.collections) {
        const colId = `${catId}|${col.collection}`;
        const colExpanded = expanded.has(colId);
        out.push({
          id: colId, label: col.collection, depth: 2,
          metrics: col.metrics, daily: col.daily,
          hasChildren: col.products.length > 0, expanded: colExpanded,
        });
        if (!colExpanded) continue;
        for (const p of col.products) {
          out.push({
            id: `${colId}|${p.sku}`, label: p.name, sublabel: p.sku, depth: 3,
            metrics: p.metrics, daily: p.daily, hasChildren: false, expanded: false,
          });
        }
      }
    }
  }
  return out;
}

function chLabel(source: string): string {
  if (source === 'shr') return 'Shoper';
  if (source === 'allegro') return 'Allegro';
  return source;
}
```

**Step 3: Implement `SalesTree.tsx`**

```tsx
'use client';
import { useMemo, useReducer, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChannelNode } from '@/lib/sales-tree';
import { flattenTree } from './flatten-tree';
import { SalesTreeRow } from './SalesTreeRow';

type State = Set<string>;
type Action = { type: 'toggle'; id: string } | { type: 'expandAll'; ids: string[] } | { type: 'collapseAll' };

function reducer(state: State, a: Action): State {
  if (a.type === 'collapseAll') return new Set();
  if (a.type === 'expandAll') return new Set(a.ids);
  const next = new Set(state);
  if (next.has(a.id)) next.delete(a.id);
  else next.add(a.id);
  return next;
}

export function SalesTree({ channels }: { channels: ChannelNode[] }) {
  const [expanded, dispatch] = useReducer(reducer, new Set<string>());
  const visible = useMemo(() => flattenTree(channels, expanded), [channels, expanded]);
  const parentRef = useRef<HTMLDivElement>(null);

  const virt = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (visible[i].depth === 3 ? 32 : 40),
    overscan: 8,
  });

  return (
    <div className="card">
      <div className="grid items-center px-3 py-2 text-[10px] uppercase tracking-wider text-ink-tertiary border-b border-line-soft"
        style={{ gridTemplateColumns: `minmax(280px, 1fr) 56px 80px 80px 110px 80px` }}>
        <div>Kanał / Kategoria / Kolekcja / Produkt</div>
        <div className="text-center">Trend</div>
        <div className="text-right">Ilość</div>
        <div className="text-right">Zamówienia</div>
        <div className="text-right">Przychód</div>
        <div className="text-right">vs poprz.</div>
      </div>
      <div ref={parentRef} style={{ height: 600, overflow: 'auto', position: 'relative' }}>
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((vi) => {
            const row = visible[vi.index];
            return (
              <div key={row.id}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)`, height: vi.size }}>
                <SalesTreeRow {...row} onToggle={() => dispatch({ type: 'toggle', id: row.id })} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run + commit**

Run: `pnpm vitest run src/components/tabs/sales-tree/`
Run: `pnpm tsc --noEmit`
Both expected: clean.

```bash
git add src/components/tabs/sales-tree/
git commit -m "feat(sales-tree): virtualized container with expand state"
```

---

## Task 8: Wire into DashboardShell

Add new tab "Sprzedaż produktowa" in tab nav + Dashboard switch.

**Files:**
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/shell/TabNav.tsx`
- Modify: `src/components/shell/DashboardShell.tsx`
- Modify: `src/components/shell/Topbar.tsx`
- Create: `src/components/tabs/SalesTreeTab.tsx`

**Step 1: Create container that fetches + renders**

`src/components/tabs/SalesTreeTab.tsx`:
```tsx
'use client';
import useSWR from 'swr';
import { useFilterContext } from '@/components/shell/FilterBar';
import { SalesTree } from './sales-tree/SalesTree';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export function SalesTreeTab() {
  const { period } = useFilterContext();
  const url = `/api/data/sales-tree?start=${period.start}&end=${period.end}`;
  const { data, error, isLoading } = useSWR(url, fetcher);

  if (isLoading) return <div className="card p-8 text-center text-ink-tertiary">Ładowanie sprzedaży produktowej…</div>;
  if (error || !data) return <div className="card p-8 text-center text-accent-negative">Błąd pobierania danych</div>;
  return <SalesTree channels={data.channels} />;
}
```

(Note: if `useFilterContext` doesn't exist, look at how `TopProducts` reads the period and use the same pattern.)

**Step 2: Add tab id everywhere**

`src/components/shell/TabNav.tsx` — add `{ id: 'sales-tree', label: 'Sprzedaż' }` between top-products and traffic-sources.
`src/components/shell/Sidebar.tsx` — add corresponding entry with icon.
`src/components/shell/Topbar.tsx` — add to API_BY_TAB and TITLE_BY_TAB.
`src/components/shell/DashboardShell.tsx` — import + render `{tab === 'sales-tree' && <SalesTreeTab />}`.

**Step 3: Manual smoke test**

Run: `pnpm dev`
Open: `http://localhost:3000`, click "Sprzedaż" tab, confirm tree renders, expand/collapse works.

**Step 4: Commit**

```bash
git add src/components/tabs/SalesTreeTab.tsx src/components/shell/
git commit -m "feat(sales-tree): mount tab in DashboardShell"
```

---

## Task 9: Search

Toolbar input on top of `SalesTree`. Fuse.js fuzzy match. When search active, auto-expand paths to hits, hide non-matching siblings.

**Files:**
- Modify: `src/components/tabs/sales-tree/SalesTree.tsx`
- Create: `src/components/tabs/sales-tree/filter-tree.ts`
- Create: `src/components/tabs/sales-tree/filter-tree.test.ts`

**Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { filterTree } from './filter-tree';

const tree = [/* same sample as flatten-tree test */];

describe('filterTree', () => {
  it('returns input unchanged for empty query', () => {
    expect(filterTree(tree, '')).toEqual(tree);
  });
  it('keeps only branches with matching products', () => {
    // ... assert that searching "molly" keeps only MOLLY collection
  });
  it('returns expanded set covering match path', () => {
    // ... assert .autoExpanded contains 'shr', 'shr|NARZUTA', 'shr|NARZUTA|MOLLY'
  });
});
```

**Step 2-4: Implement, verify, commit**

`filter-tree.ts` exports `filterTree(channels, query): { tree, autoExpanded }`. Use Fuse.js across product names and SKUs; mark every ancestor of a match as kept; collect ids for auto-expand.

Toolbar adds `<input>` controlled state; when non-empty, replace `expanded` set with `autoExpanded` and replace `channels` with filtered tree.

```bash
git commit -m "feat(sales-tree): fuzzy search with auto-expand"
```

---

## Task 10: Top-N collapse

At collection level, show top 10 products by revenue. Add a "+ N more products" pseudo-row that, when clicked, removes the limit for that collection only.

**Files:**
- Modify: `src/components/tabs/sales-tree/flatten-tree.ts`
- Modify: `src/components/tabs/sales-tree/SalesTree.tsx`

**Steps:**
1. Add `expandedAll: Set<string>` (collection ids that bypass top-N) to reducer state.
2. In `flattenTree`, when emitting product rows for a collection, if `!expandedAll.has(colId)` and `products.length > 10`, take top 10 + emit a synthetic "more" row.
3. SalesTreeRow handles `kind: 'more'` by rendering a single button row that dispatches `expandAllAt(colId)`.
4. Test the limiter logic in `flatten-tree.test.ts`.
5. Commit.

```bash
git commit -m "feat(sales-tree): top-10 product collapse with show-more"
```

---

## Task 11: ExportModal component

Modal triggered by toolbar button. Fields: format radio (XLSX / CSV), period (defaults to current). Submits → triggers download via `<a href={...}>` click.

**Files:**
- Create: `src/components/tabs/sales-tree/ExportModal.tsx`
- Modify: `src/components/tabs/sales-tree/SalesTree.tsx` (add Export button to toolbar)

**Steps:**
1. Build the modal as a tiny self-contained component (no external deps; use `<dialog>` if simple is fine).
2. On submit, build URL `/api/data/sales-tree/export?format=...&start=...&end=...&channels=...`, set `window.location.href = url` (browser handles file save via `Content-Disposition`).
3. No test needed for modal layout; smoke-test manually.
4. Commit.

```bash
git commit -m "feat(sales-tree): ExportModal stub (UI only, no backend yet)"
```

---

## Task 12: Export route — CSV format

Streams flat product rows. Polish locale: semicolon separator, BOM, UTF-8.

**Files:**
- Create: `src/app/api/data/sales-tree/export/route.ts`
- Create: `src/app/api/data/sales-tree/export/route.test.ts`

**Step 1: Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/sales-tree-query', () => ({
  fetchSalesTreeRows: vi.fn().mockResolvedValue([
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'A',
      product_name: 'A name', revenue: 100, quantity: 1, orders: 1,
      revenue_prev: 80, daily: [50, 50] },
  ]),
}));

describe('export route — CSV', () => {
  it('returns CSV with BOM, semicolon separators, header row, one product row', async () => {
    const req = new Request('http://x/api/data/sales-tree/export?format=csv&start=2026-04-01&end=2026-04-02');
    const res = await GET(req);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('.csv');
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xFEFF); // BOM
    const lines = text.slice(1).split('\n').filter(Boolean);
    expect(lines[0]).toContain('Kanał;Kategoria;Kolekcja');
    expect(lines[1]).toContain('Shoper;NARZUTA;MOLLY;A name;A;1;1;100;25,0%');
  });
});
```

**Step 2-3: Implement**

```ts
import { fetchSalesTreeRows } from '@/lib/sales-tree-query';

export const runtime = 'nodejs';

const HEADER = 'Kanał;Kategoria;Kolekcja;Nazwa produktu;SKU;Ilość;Zamówienia;Przychód;Zmiana %';

function pl(n: number, decimals = 2): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function chLabel(s: string) { return s === 'shr' ? 'Shoper' : s === 'allegro' ? 'Allegro' : s; }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const format = url.searchParams.get('format') ?? 'csv';
  if (!start || !end) return Response.json({ error: 'start/end required' }, { status: 400 });

  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',') : ['shr', 'allegro'];

  // Compare = previous period
  const days = (new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000 + 1;
  const compareEnd = new Date(new Date(start + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const compareStart = new Date(new Date(compareEnd + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const rows = await fetchSalesTreeRows({ start, end, compareStart, compareEnd, channels });

  if (format === 'csv') {
    const lines = [HEADER];
    for (const r of rows) {
      const change = r.revenue_prev > 0 ? ((r.revenue - r.revenue_prev) / r.revenue_prev) * 100 : 0;
      lines.push([
        chLabel(r.source), r.category, r.collection,
        r.product_name.replace(/;/g, ','), r.sku,
        r.quantity, r.orders, pl(r.revenue), `${pl(change, 1)}%`,
      ].join(';'));
    }
    const body = '﻿' + lines.join('\n');
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sales_${start}_${end}.csv"`,
      },
    });
  }

  // XLSX falls through to next task
  return Response.json({ error: 'xlsx not implemented yet' }, { status: 501 });
}
```

**Step 4-5: Run, verify, commit**

```bash
git commit -m "feat(sales-tree): CSV export with Polish locale + BOM"
```

---

## Task 13: Export route — XLSX format

Adds the XLSX branch using `exceljs`. Hierarchical sheet with `outlineLevel`, second flat sheet, conditional formatting on change column.

**Files:**
- Modify: `src/app/api/data/sales-tree/export/route.ts`
- Modify: `src/app/api/data/sales-tree/export/route.test.ts`

**Step 1: Test**

```ts
it('returns XLSX with two sheets: Drzewo + Suma', async () => {
  const req = new Request('http://x/api/data/sales-tree/export?format=xlsx&start=2026-04-01&end=2026-04-02');
  const res = await GET(req);
  expect(res.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.length).toBeGreaterThan(1000);
  // Optional: parse with exceljs to assert sheet names + outline levels
});
```

**Step 2: Implement XLSX branch**

In the `format === 'xlsx'` path:
1. Build the tree from rows (reuse `buildSalesTree`).
2. Walk the tree depth-first, emit one row per node with `outlineLevel = depth`. For Drzewo sheet, columns: `Poziom, Nazwa, Ilość, Zamówienia, Przychód, Zmiana %`.
3. For Suma sheet, write flat product rows (same columns as CSV).
4. Apply formatting: header bold + bg fill, subtotal rows (depth < 3) bold, conditional color on change column (green > 0, red < 0).
5. `await workbook.xlsx.writeBuffer()`, return as `Response` with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` content-type and `.xlsx` disposition.

**Step 3-5: Run, verify, commit**

```bash
git commit -m "feat(sales-tree): XLSX export with outline groups + conditional fmt"
```

---

## Task 14: Hook export button → modal → download

Make the toolbar Export button open the modal and trigger the right URL when format chosen.

**Files:**
- Modify: `src/components/tabs/sales-tree/SalesTree.tsx`
- Modify: `src/components/tabs/sales-tree/ExportModal.tsx`

Trivial: `<a href={url} download className="...">Pobierz</a>` inside the modal, dynamically built. No new test (smoke-test manually).

```bash
git commit -m "feat(sales-tree): wire export button + download flow"
```

---

## Task 15: End-to-end smoke + deploy

**Step 1:** `pnpm tsc --noEmit && pnpm vitest run` — all pass.

**Step 2: Smoke test locally**

Run: `DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) pnpm dev`
Open `http://localhost:3000`, click "Sprzedaż" tab.

Verify:
- Tree renders with both Shoper and Allegro at top
- Expanding "Shoper → NARZUTA" shows collections with sparklines
- Search "molly" filters tree to MOLLY paths only
- Click Export → modal → choose CSV → file downloads, opens correctly in Excel
- Choose XLSX → opens with two sheets, hierarchy collapses/expands in Excel

**Step 3: Deploy**

```bash
git push origin main
```

Railway auto-deploys. Verify on production URL.

**Step 4: Final commit + close**

```bash
git tag sales-tree-v1
git push --tags
```

---

## Notes / risks

- **Performance**: For >10k products in 30-day window, the SQL `array_agg` may be slow. If P95 > 1s, add `dashboard_cache` keyed by `period_key + channels`.
- **Empty categories**: If `category` or `collection` is NULL in `products_daily`, the SQL coalesce upgrades to "BEZ KATEGORII"/"BEZ KOLEKCJI" — keeps the tree complete.
- **`source = 'all'` rows**: Excluded by the `channels = ANY(...)` filter; never appear in the tree.
- **Period comparison**: `shiftPrevPeriod` produces a same-length window immediately preceding `start`. If user wants YoY, expose `compareStart`/`compareEnd` query params (already supported).
- **Test discipline**: Backend logic (tree builder, SQL query, route) is heavily tested. UI components have minimal smoke tests — visual regressions caught manually.
