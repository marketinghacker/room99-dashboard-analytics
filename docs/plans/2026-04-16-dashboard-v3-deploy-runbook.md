# Dashboard v3 — Railway deployment runbook

**Ostatnia aktualizacja:** 2026-04-16

## TL;DR

Dashboard działa na **Railway** jako jedna usługa Next.js. Dane są w **Railway Postgres** (publiczny proxy `mainline.proxy.rlwy.net:55910`, wewnętrzny `postgres.railway.internal:5432`). Sync uruchamiany co 30 minut przez Railway Cron.

---

## 1. Struktura Railway

Projekt: `room99-dashboard`

| Usługa | Rola |
|---|---|
| `postgres` (plugin) | baza danych (dashboard_cache, ads_daily, ga4_daily, sync_runs + Windsor's ad_performance_daily) |
| `nextjs-web` | aplikacja Next.js — dashboard + API + cron endpoint |

MCP serwery (Meta, Google Ads, Criteo, GA4) działają w osobnych projektach Railway Marketing Hackers i są współdzielone między klientami.

---

## 2. Pierwsze uruchomienie (one-time setup)

### 2.1 Utwórz Postgres (jeśli nie istnieje)

Railway → New → Database → PostgreSQL. Railway automatycznie skonfiguruje zmienne `DATABASE_URL`, `POSTGRES_URL` itd.

### 2.2 Połącz repo z nową usługą Next

1. Railway → New Service → GitHub repo `marketinghacker/room99-dashboard-analytics`
2. Settings → Build → `NIXPACKS` (default), komenda build: `pnpm install --frozen-lockfile && pnpm build`
3. Settings → Deploy → komenda start: `pnpm start`
4. Settings → Variables → kliknij "Reference" przy `DATABASE_URL` i wybierz usługę postgres. Resztę zmiennych (patrz `.env.example`) wpisz ręcznie.
5. Settings → Networking → Generate public domain

### 2.3 Zainicjalizuj bazę (raz)

Lokalnie z załadowanym `.env.local`:

```bash
node --env-file=.env.local --import=tsx scripts/db-migrate.ts
```

To tworzy tabele `ads_daily`, `ga4_daily`, `dashboard_cache`, `sync_runs` (idempotentne — można puszczać wielokrotnie).

### 2.4 Uruchom pierwszy sync

```bash
# Po deployu — Railway URL + CRON_SECRET
curl "https://<twoj-domain>.up.railway.app/api/cron/sync?key=<CRON_SECRET>"
```

Zwróci JSON z podsumowaniem per-platform. Sprawdź też `/api/health` — powinno zwrócić `{"ok":true,"db":"up"}`.

---

## 3. Ustawienie cron'a w Railway

Railway → `nextjs-web` → Settings → Cron Schedule:

```
Schedule:  */30 * * * *
Command:   curl -sS "${RAILWAY_PUBLIC_DOMAIN}/api/cron/sync?key=${CRON_SECRET}"
```

Alternatywa (Railway "schedule" variable): użyj zewnętrznego cron (EasyCron, Upstash) — wysyła GET co 30 min.

**Ważne:** cron POWINIEN się skończyć w <5 minut (maxDuration = 300). Obecnie cały sync + rollup zajmuje ~30 s.

---

## 4. Zmienne środowiskowe

Patrz `.env.example` w repo. Kluczowe:

| Zmienna | Wartość produkcyjna |
|---|---|
| `DATABASE_URL` | (z pluginu postgres, reference) |
| `CRON_SECRET` | losowy ciąg 32+ znaków |
| `MCP_*_URL` | URL-e z `.env.example` |
| `META_ACCOUNT_ID` | `act_295812916` |
| `GOOGLE_ADS_CUSTOMER_ID` | `1331139339` |
| `CRITEO_ADVERTISER_ID` | `55483` |
| `GA4_PROPERTY_ID` | `315856757` |
| `NEXT_PUBLIC_SENTRY_DSN` | (opcjonalnie, jeśli Sentry aktywny) |

---

## 5. Monitorowanie

**Health check:** `GET /api/health` (Railway już to robi automatycznie).

**Sync log:** `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 20;` pokazuje ostatnie uruchomienia z rowsWritten per platform.

**Dashboard cache status:** `SELECT period_key, platform, compare_key, computed_at FROM dashboard_cache ORDER BY computed_at DESC LIMIT 30;`

---

## 6. Troubleshooting

### Sync zwraca 0 rows dla platformy
- Sprawdź czy MCP serwer żyje: `curl -i <MCP_URL>` — powinien zwrócić SSE stream
- Jeśli Meta: token OAuth wygasa co ~60 dni — relogin via dashboard MCP Meta
- Jeśli Criteo: token odświeża się automatycznie, ale jeśli MCP_CRITEO_URL wrócił 502, zrestartuj mcp-criteo na Railway

### Dashboard pokazuje "Brak cache" na wszystkich tabach
- Zamocz cache ręcznie: `node --env-file=.env.local --import=tsx scripts/run-rollup.ts`
- Zweryfikuj: `SELECT COUNT(*) FROM dashboard_cache;` (powinno być ~234)

### Pinterest "pusty"
- Windsor.ai jest wolne źródłem prawdy. Jeśli brak danych > 2 dni, sprawdź Windsor dashboard.
- Obecny cap: 30 dni historii (warning widoczny w UI)

### Build na Railway fails with "@neondatabase/serverless"
- Upewnij się, że używasz commita post-`chore: swap Neon/Vercel deps`. Na Railway: Deploy → Redeploy najnowszy commit.

---

## 7. Skill chain wykorzystany przy budowie

- `superpowers:executing-plans` — faza po fazie realizacja planu
- `superpowers:test-driven-development` — Phase 2 (periods.ts, format.ts)
- `frontend-design:frontend-design` — Phase 6-8 aesthetic direction
- `superpowers:verification-before-completion` — smoke tests przed commitami

---

## 8. Co jeszcze zrobić (backlog)

- [ ] Skonfigurować Sentry DSN w prod (błędy runtime)
- [ ] Dodać `pnpm test:e2e` do CI (Playwright)
- [ ] Wyłączyć stary `sync-worker` Railway service + Vercel projekt po 48h stabilnego produ
- [ ] Rozważyć `next/image` optymalizację dla logo (obecnie 36px nie wymaga)
- [ ] Backfill historii Meta (MCP limituje do presetów — rozważyć bezpośrednie FB API)
- [ ] Dodać eksport CSV z DataTable (nice-to-have dla klienta)
