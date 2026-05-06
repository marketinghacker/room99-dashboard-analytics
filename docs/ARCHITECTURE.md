# Architecture — Room99 Dashboard

> System dashboardowy dla agencji marketingowej. Single-tenant (klient: Room99.pl), single-region (Frankfurt — Railway eu-central). Stack: Next.js 16 + Postgres + 5 zewnętrznych MCP. Cały realtime "policzony" — UI nigdy nie woła API platform na żywo, tylko czyta z `dashboard_cache`.

---

## Diagram wysokiego poziomu

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  Platformy reklamowe / sprzedażowe                       │
│   Meta Ads │ Google Ads │ Criteo │ GA4 │ BaseLinker (SHR + Allegro)      │
└─────────────────┬────────────────────────────────────────────────────────┘
                  │ REST/GraphQL/RPC + OAuth (każdy MCP ma własne creds)
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 MCP servers (Railway, workspace MarketingHackers)         │
│                                                                           │
│  mcp-meta │ mcp-ads │ mcp-criteo │ mcp-analytics │ mcp-sellrocket        │
│                                                                           │
│  [streamable HTTP / SSE legacy]                                          │
└─────────────────┬────────────────────────────────────────────────────────┘
                  │ MCP protocol (JSON-RPC over HTTP/SSE)
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (Railway service `nextjs-web`)                                │
│                                                                           │
│  ┌─────────────────────────┐    ┌────────────────────────────────────┐   │
│  │  /api/cron/sync         │    │  /api/data/<tab>                   │   │
│  │  (orchestrator)         │    │  /api/data/sales-tree/export       │   │
│  │   ↓  parallel fetch     │    │   ↓  reads dashboard_cache         │   │
│  │   ↓  withTimeout()      │    │  /api/auth/{login,logout,me}       │   │
│  │   ↓  upsert daily       │    │   ↓  JWT (jose) + httpOnly cookie  │   │
│  │   ↓  buildRollups()     │    │  /api/admin/{settings,backfill,    │   │
│  │   ↓  refresh cache      │    │     reclassify-products,rollup}    │   │
│  └─────────────┬───────────┘    └────────────────┬───────────────────┘   │
└────────────────┼─────────────────────────────────┼───────────────────────┘
                 │                                 │
                 ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Railway Postgres plugin)                   │
│                                                                           │
│  facts (writes from sync):                                                │
│    ads_daily        sellrocket_daily                                      │
│    ga4_daily        products_daily                                        │
│                                                                           │
│  derived (computed by buildRollups):                                      │
│    dashboard_cache  (period_key, platform, compare_key, payload jsonb)    │
│                                                                           │
│  ops:                                                                     │
│    sync_runs   (audit log)                                                │
│    users       (auth)                                                     │
│    editorial_copy   (agency-editable masthead)                            │
│    order_status_config  (BaseLinker filter)                               │
└──────────────────────────────────────────────────────────────────────────┘
                 ▲                                 ▲
                 │                                 │ SWR (5-min revalidate)
                 │                                 │
┌────────────────┴─────────┐         ┌─────────────┴───────────────────────┐
│  Cron-sync container     │         │  React 19 UI (Tailwind v4)          │
│  Railway service         │         │  - DashboardShell + 11 tabs         │
│  schedule */5 min        │         │  - sales-tree (Fuse.js, virtualizer)│
│  hits /api/cron/sync     │         │  - Recharts dla wykresów            │
│  ?key=$CRON_SECRET       │         │  - zustand: tab + filters           │
│  (endpoint throttluje    │         │  - SWR: dane z /api/data/*          │
│   do ~25 min)            │         └─────────────────────────────────────┘
└──────────────────────────┘
```

---

## Data flow (od cron tickera do pixela w UI)

1. **Cron-sync container** (osobny Railway service w tym samym projekcie) wykonuje co 5 min:
   ```
   GET https://room99.marketing-hackers.com/api/cron/sync?key=$CRON_SECRET
   ```
2. **Endpoint /api/cron/sync** (`src/app/api/cron/sync/route.ts`):
   - Sprawdza `CRON_SECRET`. 401 jeśli nieprawidłowy.
   - **Throttle**: jeśli ostatni successful run < 25 min temu, zwraca 200 + `skipped: true`. Dzięki temu efektywny rate to ~25–30 min, nawet przy 5-min cronie. Cron dlatego jest 5-min, że łatwiej restartować w razie błędu — stale-data-window jest mały.
   - Definiuje range: `{ start: today-7d, end: today UTC }`. **Uwaga: `end: today UTC` (nie yesterday)** — to jest patch z `5a8d08d`. Wcześniej `last_7d` kończył się na yesterday-UTC, co wykluczało większość dnia PL. Dla `Europe/Warsaw` `today UTC` zawsze obejmuje cały aktualny dzień PL.
   - Per-source: `runWithTracking(source, fn)` → wpis w `sync_runs` (status running) → `withTimeout(fn(), SOURCE_TIMEOUT_MS[source])` → status success/failed.
   - Per-source timeouts: Meta 150s, Criteo 120s (długi range × OAuth refresh), SellRocket 120s, Google/GA4 60s, Pinterest 30s.
   - Sources lecą **sekwencyjnie** (każda blokuje następną — `maxDuration = 300s` dla całego endpointu).
3. **Każdy `syncX(range)`** (`src/lib/sync/<platform>.ts`):
   - `connectMCP(MCP_URL, transport)` z `mcp-client.ts` (streamable HTTP lub SSE).
   - `callMCPTool(client, 'tool_name', args, { retries: 3, initialBackoffMs: 1000 })` — wrapper z exponential backoff.
   - Normalizacja heterogenicznej response (różne MCP-y zwracają różne kształty — `Rows`, `rows`, `data`, czasem same array).
   - **Upsert** do odpowiedniej tabeli `*_daily`. Idempotentne (`ON CONFLICT (date, platform, campaign_id) DO UPDATE`).
4. **Po wszystkich sources** → `buildRollups()` (`src/lib/rollup.ts`):
   - Czyta z `*_daily`, agreguje per `(period_key × platform × compare_key)`.
   - Zapisuje gotowy JSONB do `dashboard_cache`.
   - Periody: `last_7d`, `last_28d`, `mtd`, `qtd`, `ytd`, `last_30d` itd. (zob. `lib/periods.ts`).
   - `compare_key`: `previous`, `yoy`, `none`.
5. **UI** (Next.js client):
   - `useSWR('/api/data/<tab>?period=last_7d&compare=previous')`.
   - API endpoint: `getCached(period_key, platform, compare_key)` → zwraca payload JSONB.
   - **Sales-tree** to wyjątek: `/api/data/sales-tree` liczy SQL na żywo z `products_daily` (jeśli czas wykonania >800ms, dodać do cache — pkt 5 backloga).

**Kluczowy efekt**: UI nigdy nie czeka na MCP. Worst-case timing dla użytkownika = pojedynczy SELECT z indeksowanego cache.

---

## Schema bazy danych

Wszystkie tabele w schemacie `public`. Kluczowe kolumny niżej; pełna definicja w `src/lib/schema.ts` (Drizzle ORM).

### Fakty (fact tables, niezależne, write-heavy z syncu)

**`ads_daily`** — dzienna performance per kampania na każdej platformie reklamowej.
- PK: `(date, platform, campaign_id)`
- Kolumny: `platform` (`meta`/`google_ads`/`criteo`/`pinterest`), `account_id`, `campaign_id`, `campaign_name`, `campaign_status`, `campaign_objective`, `ad_group_id`, `ad_group_name`, `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `conversions`, `conversion_value`, `updated_at`
- Indexes: `(platform, date)`, `(date)`

**`ga4_daily`** — dzienne sesje, ecommerce per channel × source × medium.
- PK: `(date, channel_group, source, medium)`
- Kolumny: `sessions`, `users`, `new_users`, `engaged_sessions`, `bounce_rate`, `transactions`, `revenue`, `items_viewed`, `add_to_cart`, `begin_checkout`

**`sellrocket_daily`** — dzienne totalki sprzedaży z BaseLinker.
- PK: `(date, source)`. Source: `'shr'` (Shoper), `'allegro'`, `'all'` (suma), plus szczegółowe (`'ceneo'`, `'emp'`, etc.).
- Kolumny: `order_count`, `revenue`, `avg_order_value`

**`products_daily`** — dzienne sprzedaże per produkt per source.
- PK: `(date, sku, source)`
- Kolumny: `product_name`, `category`, `collection`, `quantity`, `revenue`, `orders`, `thumbnail_url`
- Klasyfikacja `category`/`collection` przez `lib/sync/sku-parser.ts` (regex + LLM-fallback).

### Derived (computed by buildRollups)

**`dashboard_cache`** — gotowe rollupy do tabów.
- PK: `(period_key, platform, compare_key)`
- Kolumny: `payload` (JSONB — cały stan tabu), `computed_at`
- Refresh: po każdym successful syncu (background) i ad-hoc przez `/api/admin/rollup`.

### Operations

**`sync_runs`** — audit log każdego przebiegu syncu.
- Kolumny: `id` (uuid), `source`, `started_at`, `finished_at`, `status` (`running`/`success`/`failed`), `rows_written`, `error`
- Czytane przez `/api/data/sync-heartbeat` i `/admin/sync-status`.

**`users`** — auth.
- Kolumny: `email`, `password_hash` (bcrypt), `role` (`'client'` | `'agency'`)
- Sesja: JWT (`jose`) → httpOnly cookie → `middleware.ts` weryfikuje na każdym request do `/api/data/*` i protected routes.

**`editorial_copy`** — agency-editable masthead text per tab. Klikany w `/admin/settings`.

**`order_status_config`** — które statusy BaseLinker liczą się jako "sprzedaż" (klikany w admin, zmienia interpretację `sellrocket_daily`).

### Relacje (concept)

```
users (1) ── session cookie ── middleware ── (n) requests
                                                  │
ads_daily ─── independent fact ──────────────┐    │
ga4_daily ─── independent fact ──────────────┤    │
sellrocket_daily ─── independent fact ───────┤    │
products_daily ─── independent fact ─────────┤    │
                                             ▼    ▼
                                  buildRollups() reads facts
                                             │
                                             ▼
                                  dashboard_cache (derived)
                                             ▲
                                             │
                                  /api/data/<tab> reads cache
                                             ▲
                                             │
                                          UI (SWR)

sync_runs ── audit log of each sync attempt (independent)
editorial_copy / order_status_config ── config tables, agency-edited
```

Brak FK między tabelami daily (świadomie — sync per platforma jest niezależny, jedna platforma może być stale gdy inna padła).

---

## Time zones — krytyczny szczegół

**Wszystkie kolumny `date` są typu PostgreSQL `date`** (bez czasu). Zapis: zawsze `YYYY-MM-DD`. **Interpretujemy jako "dzień polski" (`Europe/Warsaw`).**

W zapytaniach SQL, gdy potrzeba bezpośredniej arytmetyki na "today PL":

```sql
SELECT date, sum(revenue)
FROM products_daily
WHERE date >= (NOW() AT TIME ZONE 'Europe/Warsaw')::date - INTERVAL '7 days'
GROUP BY date
```

W syncu robimy `today UTC` zamiast `today PL` celowo: UTC ≥ PL by ~1–2h, więc `today UTC` zawsze obejmuje cały aktualny dzień PL (a płatformy zwracają zera dla "future" zwykle). Bug `5a8d08d` polegał na używaniu `last_7d` z `lib/periods.ts`, który kończył się na `yesterday UTC` — wykluczając większość dnia PL.

**Nigdy nie używaj `Date.now()`** w SQL bez ATTZ. Nigdy nie zakładaj, że JS `new Date().toISOString().slice(0,10)` daje "today PL" — daje today UTC.

---

## Period model (lib/periods.ts)

Presety: `last_7d`, `last_14d`, `last_28d`, `last_30d`, `mtd`, `qtd`, `ytd`, `prev_month`, `prev_quarter`, `prev_year`. Każdy zwraca `{ start, end, label }` (oba ISO).

**Custom range** w syncu (cron) jest definiowany lokalnie w `route.ts` jako `{ start: today-7d, end: today UTC }` — celowo NIE używa `last_7d` z `periods.ts`, bo `periods.ts` operuje na "PL day end" co nie obejmuje aktualnego dnia.

`compare_key` w cache: `previous` (poprzednie tyle dni), `yoy` (rok wstecz), `none`. UI w `FilterBar.tsx` pozwala użytkownikowi wybrać preset i compare-mode niezależnie.

---

## Co dalej

- Przeczytaj `docs/MCP-SERVERS.md` żeby zobaczyć, jak każda platforma się integruje.
- Przeczytaj `docs/DEVELOPMENT.md` przed dotknięciem kodu — konwencje, testy, naming.
- Plany w `docs/plans/` pokazują, jak doszliśmy do bieżącej architektury (ostatnie 3 plany są najbardziej aktualne).
