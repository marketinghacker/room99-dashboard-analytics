# Sales Tree View + XLSX/CSV Export — Design

**Status:** Approved 2026-05-06
**Goal:** Marketing optimization. User needs sales data per channel/category/collection/product to make campaign decisions.

## Problem

Current `top-products` and `sales-channels` tabs show flat tables. Marketing needs to drill down: which channel sells which categories best, which collections drive volume in Allegro vs Shoper, which products in a specific category are growing/declining. Then export that view for offline analysis (Excel pivots, sharing with team).

## Data source

Table `products_daily` (already populated by sync worker):
```
date, sku, product_name, category, collection, source, quantity, revenue, orders, thumbnail_url
```
- `source`: `shr` (Shoper), `allegro`, `all` (BaseLinker pseudo-source — exclude from tree)
- One row per product × day × source

## Hierarchy: 4 levels

```
Channel (Shoper / Allegro)
  └─ Category (NARZUTA, FIRANA, ZASLONA, ...)
       └─ Collection (MOLLY, NOELLE, ...)
            └─ Product (full name + SKU)
```

Each level shows aggregated metrics with subtotals; product rows are leaves.

## Metrics per row (all levels)

- **Revenue** (sum, period)
- **Quantity** (sum, period)
- **Orders** (sum, period — distinct order count for the level)
- **% change vs comparison period** — colored (sage / terracotta), comparison period = previous period of same length
- **Sparkline** — daily revenue trend across the period (16×40px SVG)

## Features

### Tree
- Virtualized list (@tanstack/react-virtual) — handles 5k+ products without lag
- Click row to expand/collapse one level
- "Expand all" / "Collapse all" buttons in toolbar
- Default sort: revenue desc on every level
- Click column header to sort (revenue / quantity / orders / change)

### Search
- Single input top-right, fuzzy match (Fuse.js) on `product_name + sku + category + collection`
- Hits auto-expand the path leading to them; non-matching siblings hidden
- Clear button restores full tree

### Top-N collapse
- At collection level, by default show top 10 products by revenue
- Remaining shown as `+ N more products` row, click to expand all
- Configurable in toolbar (10 / 50 / All)

### Filters
- **Period** picker (this_month default, presets + custom range)
- **Channel** toggle: Both / Shoper only / Allegro only (filters root level)

### Export
Toolbar button → modal: choose format + period.

**XLSX (`exceljs`):**
- Sheet 1 "Drzewo" — hierarchical rows with `outlineLevel` 0–3, Excel renders collapsable groups
- Subtotals on every node row, bold + light bg
- Conditional formatting on % change column (green / red)
- Sheet 2 "Suma" — flat product list with all columns
- Header frozen, columns auto-sized

**CSV:**
- Flat product list only
- Columns: `Channel, Category, Collection, Product Name, SKU, Quantity, Orders, Revenue, Change %`
- UTF-8 BOM for Excel compatibility, semicolon separator (Polish locale)

## Architecture

### API: `GET /api/data/sales-tree`
Query params: `start=YYYY-MM-DD&end=YYYY-MM-DD&compareStart=...&compareEnd=...&channels=shr,allegro`

Returns:
```ts
{
  channels: [
    { source: 'shr', metrics: AggregatedMetrics, daily: number[],
      categories: [
        { category: 'NARZUTA', metrics, daily,
          collections: [
            { collection: 'MOLLY', metrics, daily,
              products: [{ sku, name, metrics, daily }]
            }
          ]
        }
      ]
    }
  ]
}
```

`AggregatedMetrics`: `{ revenue, quantity, orders, revenuePrev, change }`.

Single SQL query with CTEs:
1. CTE `current` — `SUM` per `(source, category, collection, sku, date)` for current period
2. CTE `prev` — same for comparison period
3. Outer query joins, groups, builds `array_agg(daily)` ordered by date

Postgres returns rows; route assembles tree in memory (single pass).

### API: `GET /api/data/sales-tree/export`
Same query params + `format=xlsx|csv`.

Builds tree internally (reuses logic from `/sales-tree`), then serializes:
- xlsx: stream `exceljs` workbook to response
- csv: stream rows with `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="sales_2026-04-01_2026-04-30.csv"`

### Component: `SalesTree`
Path: `src/components/tabs/SalesTree.tsx`

Stateless render of the tree response; expand/collapse state in `useReducer`.

Sub-components:
- `SalesTreeRow` — one row, depth-based padding, sparkline, metrics
- `SalesTreeToolbar` — period, channel toggle, search, expand/collapse-all, export button
- `ExportModal` — format radio + period inputs + download trigger
- `Sparkline` — small SVG (memoized; pure function of `daily` array)

### Tab integration
- New entry in `DashboardShell` tab list: "Sprzedaż produktowa" between "TOP Produkty" and "Lejek"
- Or replace `TopProducts` tab — TBD with user, but for now ADD as separate tab to avoid breaking existing flows

## Performance budget

- Tree API: < 800ms for 30 days × 5k products. SQL is fast; biggest cost is `array_agg` for sparklines. Cache result in `dashboard_cache` keyed by `period_key + channels`.
- XLSX export: ~2s for 5k rows. Stream response, don't buffer.
- CSV export: ~200ms.
- Tree render: virtualized, only visible rows mount.

## Out of scope (YAGNI)

- Editing data in tree (read-only)
- Per-day breakdown inside product rows (sparkline is enough)
- Saved views / bookmarks
- Custom column ordering

## Open questions

None. User approved A→B (B+C combined) → C → C → "stop asking, build it".

## Next step

Invoke `superpowers:writing-plans` to break this into ordered implementation tasks.
