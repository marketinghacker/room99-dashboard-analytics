# Room99 Dashboard v3 — Design Document

**Status:** Approved 2026-04-16 after brainstorming session
**Supersedes:** `2026-04-16-dashboard-v3-plan.md` (that was a rough plan; this is the final design)

---

## 1. Problem statement

Dashboard v2 jest zbiorem półśrodków: Vercel + Neon + Railway miksowane, design rozjechany, date picker nie działa, dane nie syncują. Klient Room99 sp. z o.o. (zarządzany przez Marketing Hackers) oczekuje premium tool na poziomie Apple App Store Connect / Analytics — gęstość danych + polerowany UX. Odbiór krytyczny: utrata klienta przy kolejnej fali.

## 2. Goals

- **Jedna platforma.** Wszystko na Railway (Next.js app, Postgres, MCP sync). Vercel odchodzi.
- **1:1 z referencją** (`room99-dashboard-korekta 19.02.html`, 2643 linii, 10 tabów) pod względem struktury i metryk — styl wymieniamy na Apple Keynote.
- **Funkcjonalny filter bar:** okres + porównanie, zmiana natychmiast odświeża wszystkie widoki.
- **Wszystkie koszty w jednym miejscu** — w tym Pinterest (brak natywnego API → Windsor.ai jako tymczasowy most).
- **Niezawodność.** Sync worker z retry, graceful degradation gdy padnie pojedyncze źródło.

## 3. Non-goals

- BaseLinker / SellRocket w v3 — pomijamy (niska wartość dla klienta teraz).
- Dashboard dla wielu klientów / multi-tenancy — single-tenant Room99.
- Mobile native app — responsive web wystarczy.
- Historia > 90 dni w v3 — backfill w v3.1.

## 4. Architektura

### 4.1 Usługi na Railway (jeden projekt: `room99-dashboard-sync`)

```
┌─ Service: nextjs-web ──────────────────┐
│  Next.js 15 App Router                 │
│  • Frontend (SPA hybrid, 10 tabów)     │
│  • API routes /api/data/*              │
│  • API route /api/cron/sync (Railway   │
│    cron hits this co 30 min)           │
│  • API route /api/admin/*              │
└────────────────────────────────────────┘
            ↕ DATABASE_URL (internal)
┌─ Service: Postgres ────────────────────┐
│  Railway managed Postgres              │
│  Tables: ads_daily, ga4_daily,         │
│          ad_performance_daily,         │
│          dashboard_cache, sync_runs    │
└────────────────────────────────────────┘
            ↑
┌─ External: Windsor.ai (paid ~$20/mo) ──┐
│  Daily sync o 04:00 UTC                │
│  Pisze do ad_performance_daily         │
└────────────────────────────────────────┘
            ↑
┌─ External: MCP servers (już deployed) ─┐
│  mcp-analytics, google-ads-mcp, mcp-   │
│  meta, mcp-criteo — wywoływane przez   │
│  /api/cron/sync, wypełniają ads_daily, │
│  ga4_daily                             │
└────────────────────────────────────────┘
```

**Stary sync-worker service kasujemy** gdy `/api/cron/sync` pracuje stabilnie (>48h bez incydentu).

### 4.2 Dlaczego nie osobny worker

- Jeden codebase → mniej kontekstu do utrzymania (single-dev project).
- Railway cron woła HTTP endpoint — zero overhead vs osobny serwis.
- Shared types, shared DB client, shared logika formatowania.

### 4.3 Stack techniczny

- **Next.js 15** (App Router), TypeScript strict
- **Drizzle ORM** (szybki, TypeScript-native, nie ma ceremonii Prismy)
- **Zustand** (globalny state: period, compare)
- **SWR** (data fetching + cache)
- **Tailwind 4** + **shadcn/ui** (primitives)
- **Recharts** (line/bar/pie charts)
- **TanStack Table** (tabele kampanii/produktów)
- **Framer Motion** (animacje)
- **Vitest** (unit + integration)
- **Playwright** (E2E + visual regression)

## 5. Model danych

### 5.1 Tabele (Drizzle schema w `src/lib/schema.ts`)

**`ads_daily`** — kanoniczne dzienne metryki reklamowe (Meta, Google Ads, Criteo). Pisze sync worker przez MCP.

```ts
{
  date: date,
  platform: text,            // 'meta' | 'google_ads' | 'criteo'
  account_id: text,
  campaign_id: text,
  campaign_name: text,
  campaign_status: text,
  campaign_objective: text,
  ad_group_id: text | null,
  ad_group_name: text | null,
  spend: numeric,
  impressions: integer,
  clicks: integer,
  ctr: numeric,
  cpc: numeric,
  cpm: numeric,
  conversions: numeric,
  conversion_value: numeric,
  updated_at: timestamptz
}
// unique: (date, platform, campaign_id)
// index: (platform, date), (date)
```

**`ad_performance_daily`** — Windsor sink (Pinterest dziś, opcjonalnie inne jako backup). Schemat dziedziczony z Windsora, nie zmieniamy.

**`ga4_daily`** — GA4 dane (sessions, revenue, funnel). Pisze sync worker przez MCP GA4.

```ts
{
  date: date,
  channel_group: text,       // 'Paid Search', 'Organic', 'Direct', 'Paid Social', ...
  source: text,
  medium: text,
  sessions: integer,
  users: integer,
  new_users: integer,
  bounce_rate: numeric,
  engaged_sessions: integer,
  transactions: integer,
  revenue: numeric,
  items_viewed: integer,
  add_to_cart: integer,
  begin_checkout: integer,
  updated_at: timestamptz
}
// unique: (date, channel_group, source, medium)
```

**`dashboard_cache`** — pre-computed rollupy.

```ts
{
  period_key: text,          // 'last_30d', 'this_month', 'custom_2026-03-01_2026-04-15', ...
  platform: text,            // 'meta' | 'google_ads' | 'criteo' | 'pinterest' | 'ga4' | 'all'
  compare_key: text | null,  // 'previous_period', 'same_period_last_year', null
  payload: jsonb,            // ready-to-render blob per tab
  computed_at: timestamptz
}
// primary: (period_key, platform, compare_key)
```

**`sync_runs`** — observability.

```ts
{
  id: uuid,
  started_at: timestamptz,
  finished_at: timestamptz | null,
  status: text,              // 'running' | 'success' | 'partial' | 'failed'
  source: text,              // 'meta_mcp' | 'google_ads_mcp' | ... | 'rollup'
  rows_written: integer,
  error: text | null
}
```

### 5.2 Flow zapytania

```
User klika "Ostatnie 30 dni" + "Poprzedni okres"
  → /api/data/executive-summary?period=last_30d&compare=previous
  → lookup dashboard_cache WHERE period_key='last_30d' AND platform='all' AND compare_key='previous_period'
  → jeśli cache świeży (computed_at w ciągu 30 min) → zwróć payload
  → jeśli brak / stale → on-the-fly z ads_daily + ga4_daily, zapisz do cache, zwróć
```

### 5.3 Rollup job

- Wywoływany przez `/api/cron/sync` (co 30 min) po zakończeniu MCP sync
- Dla każdego `period_key` z listy presetów × każdej platformy × każdego `compare_key` → agreguj + UPSERT
- ~13 presetów × 6 platform × 4 warianty porównania = ~300 rekordów cache, refresh w <30s
- Custom ranges liczone on-demand (cache'owane per unique range string przez 1h)

## 6. Period semantics (date picker)

### 6.1 Presety (Q4, wariant B)

| Key | Zakres |
|---|---|
| `today` | dziś (żywe dane) |
| `yesterday` | wczoraj |
| `last_7d` | wczoraj − 6 dni → wczoraj |
| `last_30d` | wczoraj − 29 dni → wczoraj |
| `last_90d` | wczoraj − 89 dni → wczoraj |
| `this_week` | poniedziałek tego tygodnia → dziś |
| `last_week` | poniedziałek zeszły → niedziela zeszła |
| `this_month` | 1. bieżącego → dziś |
| `last_month` | pełny poprzedni miesiąc |
| `this_quarter` | start kwartału → dziś |
| `last_quarter` | pełny poprzedni kwartał |
| `this_year` / `ytd` | 1 stycznia → dziś |
| `custom` | dowolne dwie daty |

**Reguła:** wszystkie okna kończące się „wczoraj włącznie" (pomijamy dziś, bo niekompletne). Wyjątek: `today`, `this_week`, `this_month`, `this_quarter`, `ytd` — te z definicji zawierają dziś.

### 6.2 Porównania

| Key | Jak liczone |
|---|---|
| `previous_period` | ten sam czas, przesunięty wstecz o długość okresu |
| `same_period_last_year` | ten sam kalendarzowy zakres rok wcześniej |
| `same_period_last_quarter` | ten sam zakres (ratio) w poprzednim kwartale |
| `none` | brak porównania, delty schowane |

### 6.3 Pinterest guard

- Jeśli `period_key` wymaga >30 dni danych → badge `Pinterest: ograniczone do 30d (czeka na API)` na karcie Pinterest + w sekcjach mieszanych
- Wartości Pinterest w Executive Summary dla dłuższych okien liczone z dostępnych 30 dni + flagowane

## 7. Frontend — struktura 10 tabów

Hash-based routing (`#pinterest`, `#meta-ads` itd.) — linki share-owalne.

### 7.1 Layout każdego taba (Apple Keynote style)

```
┌──────────────────────────────────────────────────────────────┐
│ HERO (min 320px wysokości)                                   │
│   — 2-3 największe KPI jako 72px numeryka                    │
│   — label małą kapitalą pod spodem                           │
│   — delta badge (▲ +12.3% zielony / ▼ -5.1% czerwony)        │
│                                                              │
│ CHART PRIMARY (min 400px wysokości)                          │
│   — jeden duży line chart trendu (spend / revenue / sessions)│
│   — osie subtelne, grid ledwie widoczny                      │
│                                                              │
│ SCORECARDS GRID (3 × 2 lub 4 × 1)                            │
│   — 28-32px numeryka, label, delta                           │
│                                                              │
│ DATA TABLE (pełna szerokość)                                 │
│   — kampanie / źródła / produkty                             │
│   — sticky header, kolumny sortable, paginacja               │
└──────────────────────────────────────────────────────────────┘
```

Między sekcjami **64-96px whitespace**. To jest świadome — klient widzi przestrzeń jako premium.

### 7.2 Mapowanie tabów → metryki

| Tab | Hero metryki | Chart | Scorecards | Tabela |
|---|---|---|---|---|
| **Executive Summary** | Revenue total, Spend total, **COS** | Revenue + Spend trend | Sessions, Transactions, AOV, ROAS | Per-platform breakdown |
| **Performance Marketing** | Total Spend, Conversions, COS | Spend stacked per platform | CTR avg, CPC avg, CPM avg, Conv rate | Wszystkie kampanie cross-platform |
| **Google Ads** | Spend, Conv value, COS | Daily spend | CTR, CPC, CPM, Impression share | Kampanie Google |
| **Meta Ads** | Spend, Conv value, COS | Daily spend | CTR, CPC, CPM, Reach | Kampanie Meta (act_295812916) |
| **Pinterest** | Spend, ROAS, Clicks | Daily spend | CTR, CPC, CPM, Impressions | Kampanie Pinterest (z badge 30d) |
| **Criteo** | Spend, Revenue, ROAS | Daily spend | CTR, CPC, CPM | Kampanie Criteo |
| **Katalogi** (Product Catalogs) | Active SKUs, Catalog spend, ROAS | Trend spend | Best performing catalog, worst | Per-catalog breakdown |
| **Lejek** (Funnel) | Sessions → ATC → Checkout → Purchase | Funnel bar | Conv rate per step, drop-off rate | Events by step |
| **Źródła Ruchu** | Sessions total, New users, Engaged % | Sessions per channel | Per channel breakdown | GA4 source/medium tabela |
| **TOP Produkty** | #1 revenue product, #1 units | Top 10 bar | Revenue-based ranking | Full product list sortable |

### 7.3 Struktura katalogów

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # <DashboardShell />
│   ├── globals.css                 # Tailwind + tokens
│   ├── api/
│   │   ├── cron/sync/route.ts      # Railway cron target
│   │   ├── admin/
│   │   │   ├── sync-log/route.ts
│   │   │   └── settings/route.ts
│   │   └── data/
│   │       ├── executive-summary/route.ts
│   │       ├── performance-marketing/route.ts
│   │       ├── google-ads/route.ts
│   │       ├── meta-ads/route.ts
│   │       ├── pinterest/route.ts
│   │       ├── criteo/route.ts
│   │       ├── product-catalogs/route.ts
│   │       ├── funnel/route.ts
│   │       ├── traffic-sources/route.ts
│   │       └── top-products/route.ts
├── components/
│   ├── shell/         # DashboardShell, Header, FilterBar, TabNav
│   ├── tabs/          # 10 tabów jako React components
│   ├── primitives/    # HeroMetric, ScoreCard, DeltaBadge, charts, tables
│   └── ui/            # shadcn primitives
├── lib/
│   ├── db.ts
│   ├── schema.ts
│   ├── periods.ts     # date range + compare logic
│   ├── format.ts      # pl-PL, PLN, %, dates
│   ├── sync/          # MCP fetchers per platform
│   └── rollup.ts      # cache builder
└── stores/
    └── filters.ts     # Zustand: period, compare
```

## 8. Design system

### 8.1 Typografia

```
Stack: -apple-system, "SF Pro Display", Inter, system-ui
Features: font-feature-settings: "tnum" (tabular nums) on all numeric cells

Hero numeric:   72px / 700 / tracking -0.03em
Section H1:     40px / 600 / tracking -0.02em
Card H2:        22px / 600 / tracking -0.01em
Body:           15px / 400 / line-height 1.6
Label:          12px / 500 / uppercase / tracking 0.05em / opacity 60%
Data numeric:   28-32px / 600 / tnum
```

### 8.2 Paleta (Apple-first, Room99 akcenty)

```
bg-base:          #FBFBFD  (Apple marketing bg)
bg-card:          #FFFFFF
bg-elevated:      #F5F5F7
border-subtle:    #E5E5EA
border-strong:    #D2D2D7
ink-primary:      #1D1D1F
ink-secondary:    #6E6E73
ink-tertiary:     #86868B

Stany:
accent-positive:  #30D158  (zielony delta ▲)
accent-negative:  #FF453A  (czerwony delta ▼)
accent-warning:   #FF9F0A  (Pinterest 30d badge, sync stale alert)
accent-primary:   #0071E3  (Apple link blue)

Chart sequential (w kolejności użycia — Room99 warm accents first):
  1. #C9A79C  (pudrowy róż / powder rose — Room99 brand)
  2. #6A8470  (butelkowa zieleń — Room99 brand)
  3. #0071E3  (Apple blue)
  4. #BF8E4C  (ciepły beż / gold — Room99 brand)
  5. #BF5AF2  (purple — Apple supplementary)
  6. #64D2FF  (cyan — Apple supplementary)
```

Palety brand Room99 dobrane z wizualnej inspekcji room99.pl (warm pastele, muted jewels). Finalne hexy można podmienić po konsultacji z klientem; architektura designu (Apple primary + Room99 akcent w chartach) zostaje.

### 8.3 Spacing + layout

- Baseline: 4px. Skala: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Container: `max-w-[1440px]`, `px-8` mobile / `px-16` desktop
- Sekcje karty: `p-8` (32px), `rounded-2xl` (16px)
- Shadow premium: `0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)`
- Shadow hover: `0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)` + `scale(1.01)`

### 8.4 Animacje

- Tab change: fade+slide 200ms `easeOut`
- Hero count-up: 300ms `easeOut` przy zmianie period
- Card hover: `scale(1.01)` 150ms
- Chart: Recharts built-in `animationDuration: 400`
- Brak „floaty" / parallaxu — to dashboard, nie landing page

### 8.5 Header sticky (Apple nav pattern)

- `position: sticky; top: 0`
- Scroll > 20px → `backdrop-filter: blur(20px) saturate(180%)` + `bg-white/70`
- Border bottom subtle (1px `#E5E5EA` at 60% opacity)
- Logo po lewej (Room99 wordmark PNG, max-height 32px), tytuł „Performance Dashboard" 15px/600, FilterBar po prawej

### 8.6 Język interfejsu

- **Labels PL:** „Okres", „Porównaj", „Kampanie", „Wydatki", „Przychód", „Konwersje"
- **Metryki natywnie:** CTR, CPC, CPM, COS, ROAS, CR (zamiast „współczynnik klikalności" itp.)
- Daty format PL: „17 mar 2026", waluta „47 235 zł" (spacja jako tysięczny, „zł" po liczbie)

## 9. Error handling + graceful degradation

| Scenariusz | Zachowanie |
|---|---|
| Platforma pada (Criteo 500) | `<EmptyState>` w karcie tej platformy, reszta działa |
| Sync worker stale > 1h | `<Alert variant="warning">` w headerze: „Ostatnia synchronizacja: 2h temu" |
| Windsor brak `conversions` | COS reverse-computed z ROAS, tooltip `ⓘ szacowane` |
| Custom range > 90 dni | Warning + fallback do ostatnich 90 |
| API 500 | SWR retry 2× z exponential backoff, potem skeleton + alert |
| Loading | Skeleton matching real layout (nie spinner) |
| MCP rate limit | Sync worker exponential backoff (1s → 16s, 5 prób), log do `sync_runs` |

### 9.1 Observability

- Railway logs + **Sentry** (free tier: 5k errors/mc) dla błędów frontendu i API
- Tabela `sync_runs` widoczna w `/admin/sync-log` (auth: basic auth env-based)
- Slack webhook opcjonalnie w przyszłości (v3.1)

## 10. Testing

Pragmatyczny zakres, nie overengineer.

- **Unit (Vitest):** `lib/periods.ts`, `lib/format.ts`, `lib/rollup.ts` — tu się łatwo pomylić
- **Integration (Vitest + testcontainers-node):** `/api/data/*` endpoints przeciw efemerycznej Postgresowej instance
- **E2E (Playwright):** 1 smoke test — dashboard ładuje się, każdy tab otwiera się, date picker zmienia liczby
- **Visual regression (Playwright):** screenshot snapshots per tab × 2 presety — wychwyci zepsute CSS

## 11. Deployment

### 11.1 Railway setup

- **Projekt:** `room99-dashboard-sync` (istniejący, `defafc8d-d33f-4bde-93b9-3f9dc8eafa81`)
- **Services:**
  - `nextjs-web` (nowy, z repo `marketinghacker/room99-dashboard-analytics`)
  - `Postgres` (istniejący, `mainline.proxy.rlwy.net:55910`)
  - `sync-worker` (stary, **usunąć** po 48h stabilnej pracy nowego `/api/cron/sync`)
- **Cron:** Railway „Cron Jobs" feature → `*/30 * * * *` → hit `https://<nextjs-web>/api/cron/sync?key=$CRON_SECRET`
- **Env vars** (w `nextjs-web`):
  ```
  DATABASE_URL=postgres://postgres:***@postgres.railway.internal:5432/railway
  MCP_API_KEY=***
  CRON_SECRET=*** (random 32 chars)
  SENTRY_DSN=***
  GA4_PROPERTY_ID=315856757
  GOOGLE_ADS_CUSTOMER_ID=1331139339
  META_AD_ACCOUNT_ID=act_295812916
  CRITEO_ADVERTISER_ID=55483
  ```

### 11.2 Rollout (plan ramowy — szczegóły w writing-plans phase)

- **Dzień 1:** Drizzle schema + migracje + sync worker MVP (1 platforma: Meta), cron co 30 min
- **Dzień 2-3:** Reszta MCP fetcherów (Google Ads, Criteo, GA4), rollup job, `dashboard_cache`
- **Dzień 4:** Shell + FilterBar + 2 taby MVP (Executive Summary, Meta Ads) via `frontend-design` skill
- **Dzień 5:** Reszta 8 tabów, polish
- **Dzień 6:** Testy, Sentry, visual regression
- **Dzień 7:** Deploy prod, smoke test na żywych danych, klient ogląda
- **Dzień 7-14:** iteracja na feedback, usunięcie starego sync-worker service

### 11.3 Rollback plan

- Stara wersja dashboardu na Vercel zostaje żywa przez 14 dni na wypadek regresji (dopiero potem Vercel project delete)
- Railway preview deployments z PR-ów — każda zmiana testowana na preview przed merge
- Sentry łapie błędy prod → Slack (v3.1)

## 12. Brand assets

- **Logo:** `public/brand/room99-logo.png` (pobrane z room99.pl, 382×156 PNG, czarny wordmark „AESTHETIC HOME / ROOM99®")
- **Finalne brand colors:** do potwierdzenia z klientem w fazie `frontend-design` (wstępne hexy w §8.2 pkt „Chart sequential" — inspiracja room99.pl)

## 13. Open questions / następne kroki

Brak blockerów do rozpoczęcia implementacji.

Drobne do wyjaśnienia w trakcie:
- **Pinterest Developer App** — Marcin rejestruje równolegle, gdy approval przyjdzie (2-10 dni roboczych) budujemy own MCP, migrujemy z Windsora, redukujemy koszt do 0 zł
- **Windsor URL fix** — Marcin ma poprawić `date_preset=last_30d` → `last_90d` i dodać `conversions`, `conversion_value` do fields (pomijamy jeśli Standard plan nie udostępnia)
- **MVP priority** — Executive Summary + Meta Ads jako pierwsze do pokazania klientowi (reszta w dniu 5)
- **Sentry** — domyślnie tak, free tier wystarczy

## 14. Następny krok w procesie

Invoke `writing-plans` skill → rozpisze ten design na konkretny implementacyjny plan z checkpointami i zadaniami.

Po planie: `test-driven-development` (lib/periods + lib/rollup) → `frontend-design` (komponenty + tokeny) → `build-dashboard` (charts + layouty per tab).
