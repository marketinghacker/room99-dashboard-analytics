# Room99 — Performance Dashboard

> Premium-quality performance-marketing dashboard dla **Room99.pl** (Polski sklep z tekstyliami domowymi: zasłony, firany, narzuty, pościele).
>
> Agreguje dane z Meta Ads, Google Ads, Pinterest, Criteo, GA4 oraz BaseLinker SHR/Allegro w jeden spójny widok z porównaniami okresów (MoM, YoY).

**Live:** https://room99.marketing-hackers.com

## Stack

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand · SWR · Recharts · TanStack Table · Framer Motion
- **Backend:** Drizzle ORM · PostgreSQL (Railway) · Node.js 22
- **Sync:** `@modelcontextprotocol/sdk` + remote MCP servers na Railway
- **Auth:** JWT (jose) + bcrypt + httpOnly cookie + role-based middleware
- **Test:** Vitest + React Testing Library + jsdom + Playwright
- **Deploy:** Railway (Next.js + Postgres + cron-sync container)

## 📚 Dokumentacja dla developera

**Zaczynasz pracę z projektem? Czytaj w tej kolejności:**

1. **[`docs/HANDOFF.md`](docs/HANDOFF.md)** — pełny handoff: jak została zbudowana aplikacja, gdzie szukać czego, lista wszystkich zewnętrznych usług
2. **[`docs/CREDENTIALS.md`](docs/CREDENTIALS.md)** — gdzie znaleźć każdy klucz/token (panele Railway/GitHub/Anthropic)
3. **[`docs/MCP-SERVERS.md`](docs/MCP-SERVERS.md)** — wszystkie MCP serwery, URL-e, narzędzia, OAuth status
4. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — system design, przepływ danych, schemat bazy
5. **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** — workflow, konwencje, jak dodać nową funkcjonalność
6. **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — Railway, cron, monitoring, rollback
7. **[`docs/CLAUDE-PROMPT.md`](docs/CLAUDE-PROMPT.md)** — gotowy prompt dla Claude Code, żeby kontynuować pracę

## Szybki start

```bash
git clone https://github.com/marketinghacker/room99-dashboard-analytics
cd room99-dashboard-analytics
pnpm install

# Uzupełnij .env.local — patrz docs/CREDENTIALS.md
cp .env.example .env.local

# Uruchom migrację bazy (idempotentne — bezpieczne wielokrotnie)
node --env-file=.env.local --import=tsx scripts/db-migrate.ts

# Dev server
pnpm dev   # → http://localhost:3000
```

## Architektura w 1 obrazku

```
┌──────────────────────────────────────────────────────────────────────┐
│                       MCP servers (Railway)                          │
│  meta │ google-ads │ criteo │ ga4 │ sellrocket (BaseLinker proxy)    │
└──────────────┬───────────────────────────────────────────────────────┘
               │ MCP protocol (HTTP/SSE)
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js app (Railway) — service: nextjs-web                         │
│                                                                       │
│  /api/cron/sync ────► fetchPlatform() ──► upsert ads_daily/ga4_daily │
│        ▲                                            │                 │
│        │  every 30 min                              ▼                 │
│        │                                   buildRollups() ──► dashboard_cache │
│  External cron-sync container                                         │
│                                                                       │
│  /api/data/*  ──► reads dashboard_cache  ──► UI (SWR)                │
│  /api/auth/*  ──► JWT login + middleware                             │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
                 PostgreSQL (Railway)
                 ads_daily · ga4_daily · sellrocket_daily ·
                 products_daily · dashboard_cache · sync_runs · users
```

## Stan funkcjonalny (2026-05-06)

✅ Live, 5 platform synchronizowanych:
- Meta Ads (account `act_295812916`)
- Google Ads (customer `1331139339`)
- Criteo (advertiser `55483`)
- GA4 (property `315856757`)
- BaseLinker SHR + Allegro

✅ 11 zakładek dashboardu:
1. Podsumowanie (Executive Summary)
2. Performance Marketing
3. Sales Channels (Shoper vs Allegro)
4. **Sprzedaż produktowa** (4-poziomowe drzewo + eksport CSV/XLSX)
5. Google Ads
6. Meta Ads
7. Pinterest Ads (manual CSV upload)
8. Criteo
9. Product Catalogs
10. Traffic Sources (GA4)
11. Top Products

✅ Cron co 30 min, dane utrzymywane na bieżąco
✅ Eksport CSV + XLSX dla drzewa sprzedaży
✅ Search + top-N collapse + sparklines
✅ JWT auth + role-based access (client/agency)

## Status testów

```
Test Files  35+ passing
Tests       180+ passing (sales-tree feature: 35/35)
TypeScript  clean
```

## Podstawowe komendy

| Komenda | Opis |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm test` | Vitest tests |
| `pnpm vitest run <path>` | Single file/folder |
| `pnpm tsc --noEmit` | TypeScript check |
| `pnpm db:generate` | Generate Drizzle migration |
| `node --env-file=.env.local --import=tsx scripts/db-migrate.ts` | Run migration |
| `node --env-file=.env.local --import=tsx scripts/smoke-sync.ts meta` | Test single platform sync |
| `railway logs --service nextjs-web` | Production logs |

## Linki

- **Live:** https://room99.marketing-hackers.com
- **GitHub:** https://github.com/marketinghacker/room99-dashboard-analytics
- **Railway:** https://railway.com/project/defafc8d-d33f-4bde-93b9-3f9dc8eafa81
- **Reference HTML (źródło designu):** `/Users/marcinmichalski/Downloads/room99-dashboard-korekta 19.02.html` (Looker Studio mockup)

## Licencja

Prywatny projekt agencji Marketing Hackers. Wszelkie prawa zastrzeżone.
