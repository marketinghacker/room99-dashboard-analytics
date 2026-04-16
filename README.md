# Room99 — Performance Dashboard

Premium-quality performance-marketing dashboard dla **Room99.pl**. Agreguje dane z Meta Ads, Google Ads, Pinterest, Criteo oraz GA4 w jeden spójny widok z porównaniami okresów.

**Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM · PostgreSQL (Railway) · Tailwind 4 · Zustand · SWR · Recharts · TanStack Table · Framer Motion · @modelcontextprotocol/sdk.

## Szybki start

```bash
pnpm install
cp .env.example .env.local   # uzupełnij DATABASE_URL + MCP URLs
pnpm db:generate              # generuje migrację Drizzle
node --env-file=.env.local --import=tsx scripts/db-migrate.ts   # apply (idempotent)
pnpm dev                      # http://localhost:3000
```

## Architektura

```
MCP servers (Meta/Google Ads/Criteo/GA4)  →  /api/cron/sync (every 30min)
                                                    ↓
                                            ads_daily + ga4_daily
                                                    ↓
                                          buildRollups()  →  dashboard_cache
                                                                ↓
                                                 /api/data/*  →  UI (SWR + Zustand)
```

Pinterest: dane trafiają bezpośrednio do `ad_performance_daily` przez Windsor.ai — nasz adapter (`src/lib/sync/pinterest.ts`) odczytuje je i normalizuje do wspólnej struktury.

## Skrypty

| Skrypt | Opis |
|---|---|
| `pnpm dev` | dev server (Turbopack) |
| `pnpm build` | production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm db:generate` | generuje migrację Drizzle z `src/lib/schema.ts` |
| `scripts/db-migrate.ts` | uruchamia migrację na Railway Postgres |
| `scripts/smoke-sync.ts <platform>` | testuje sync pojedynczej platformy |
| `scripts/run-rollup.ts` | przebudowa `dashboard_cache` |
| `scripts/probe-mcp.ts <url> [tool]` | inspekcja MCP serwera |

## Struktura katalogów

```
src/
  app/
    page.tsx                  # DashboardShell
    api/
      cron/sync/              # orchestrator: syncMeta+syncGoogleAds+… → buildRollups
      data/                   # 10 endpointów SWR zwracających cached rollups
      health/                 # liveness + db ping
  components/
    shell/                    # Header, TabNav, FilterBar, DashboardShell
    primitives/               # HeroMetric, ScoreCard, DeltaBadge, charts, DataTable
    tabs/                     # 10 widoków (ExecutiveSummary, MetaAds, Funnel, …)
    ui/Select.tsx             # custom dropdown (Keynote-styled)
  lib/
    schema.ts                 # Drizzle
    db.ts                     # pg pool + drizzle client
    periods.ts                # 13 presetów + compare logic (TDD)
    format.ts                 # pl-PL formatters (TDD)
    rollup.ts                 # cache builder
    api.ts                    # route helpers (parseFilters, getCached)
    sync/
      mcp-client.ts           # SDK wrapper + retry + JSON extractor (TDD)
      meta.ts | google-ads.ts | criteo.ts | ga4.ts | pinterest.ts
  stores/                     # zustand (filters, active tab)
drizzle/                      # generated migrations
docs/plans/                   # design doc, implementation plan, deploy runbook
scripts/                      # local tooling
```

## Deploy

Zobacz [`docs/plans/2026-04-16-dashboard-v3-deploy-runbook.md`](docs/plans/2026-04-16-dashboard-v3-deploy-runbook.md).

## Aktualny stan danych (2026-04-16)

- **2 416 741 zł** przychodu GA4 w ostatnich 30 dniach
- **296 362 zł** wydatków marketingowych → **8.15× ROAS**, **12.26% COS**
- **330 162** sesji, **11 581** transakcji, **AOV 209 zł**
- 5 platform aktywnie synchronizowanych, 234 wpisy w `dashboard_cache`
