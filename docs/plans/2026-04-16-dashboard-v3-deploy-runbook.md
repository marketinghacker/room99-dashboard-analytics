# Dashboard v3 — Railway deployment runbook

**Ostatnia aktualizacja:** 2026-04-17 (deploy 00:00)

## TL;DR

Wszystkie sync'e i rollup **działają na Railway** (serwer agencji), nie na Twoim komputerze. Jedno kliknięcie w Railway dashboard → CRON co 30 min dociąga wczoraj. Początkowy backfill marca odpalasz przez URL jednym curl.

---

## 1. Wymagania

- Dostęp do Railway project: `Room99 Marketing Hackers` (lub dowolny inny)
- Uprawnienia do repo: `https://github.com/marketinghacker/room99-dashboard-analytics`
- Hasło admina (lub token) do Railway

---

## 2. Deploy krok po kroku (pierwszy raz)

### 2.1 Utwórz lub podepnij PostgreSQL

Railway → `+ New` → `Database` → `PostgreSQL`. Nazwij `room99-postgres`.

Jeśli już masz tę bazę (plugin z poprzedniej iteracji dashboardu), pomiń — użyjemy istniejącej.

### 2.2 Deploy aplikacji Next.js

Railway → `+ New` → `GitHub Repo` → wybierz `marketinghacker/room99-dashboard-analytics`.

Settings → **Build**:
- Builder: `NIXPACKS` (default)
- Build Command: `pnpm install --frozen-lockfile && pnpm build`

Settings → **Deploy**:
- Start Command: `pnpm start`
- Healthcheck Path: `/api/health`
- Healthcheck Timeout: `30`

Settings → **Networking** → `Generate Domain` — zapisz URL, np. `room99-dashboard-production.up.railway.app`.

### 2.3 Env Variables (Railway → Variables)

Kliknij `+ New Variable` dla każdego:

```
DATABASE_URL              → Reference: PostgreSQL.DATABASE_URL (lub $.DATABASE_PUBLIC_URL jeśli musisz)
CRON_SECRET               → kliknij Generate (32+ znaków losowych), skopiuj, zapisz u siebie
MCP_META_ADS_URL          → https://mcp-meta.up.railway.app/mcp
MCP_GOOGLE_ADS_URL        → https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp
MCP_CRITEO_URL            → https://mcp-criteo.up.railway.app/mcp
MCP_GA4_URL               → https://mcp-analytics.up.railway.app/mcp
MCP_BASELINKER_URL        → https://mcp-sellrocket.up.railway.app/mcp
META_ACCOUNT_ID           → act_295812916
GOOGLE_ADS_CUSTOMER_ID    → 1331139339
CRITEO_ADVERTISER_ID      → 55483
GA4_PROPERTY_ID           → 315856757
```

Po zapisie: Deploy uruchomi się automatycznie.

### 2.4 Migracja bazy (jednorazowa, lokalnie)

Schema trzeba wdrożyć RAZ. Odpal lokalnie wskazując na public proxy URL:

```bash
# skopiuj DATABASE_URL (public) z Railway → PostgreSQL → Data → Connect
export DATABASE_URL='postgresql://postgres:HASŁO@mainline.proxy.rlwy.net:55910/railway'
node --env-file=.env.local --import=tsx scripts/db-migrate.ts
```

Idempotentne — można puszczać wielokrotnie. Tworzy `ads_daily`, `ga4_daily`, `sellrocket_daily`, `dashboard_cache`, `sync_runs`.

### 2.5 Healthcheck

W przeglądarce: `https://<TWOJ-DOMAIN>.up.railway.app/api/health` → oczekiwane `{"ok":true,"db":"up"}`.

### 2.6 Ustaw Cron co 30 min

W Railway → `<dashboard service>` → Settings → scroll do sekcji **Cron Schedule** (lub utwórz osobny service "cron" jeśli Railway wymaga):

```
Schedule:  */30 * * * *
Command:   curl -sS -X POST "${RAILWAY_PUBLIC_DOMAIN}/api/cron/sync?key=${CRON_SECRET}"
```

Pierwszy tick uruchomi się w ciągu 30 min. Sprawdź live logi → powinien zobaczyć syncy wszystkich platform.

### 2.7 Initial backfill marca (opcjonalnie, jednorazowo)

Domyślnie cron dociąga tylko **wczoraj/ostatni tydzień**. Aby wypełnić marzec:

```bash
# fire-and-forget — URL zwraca 200 natychmiast, sync trwa ~1-2h w tle
CRON_SECRET="to-co-wpisałeś-w-Railway"
DOMAIN="room99-dashboard-production.up.railway.app"

curl -sS -X POST "https://$DOMAIN/api/admin/backfill?key=$CRON_SECRET&start=2026-03-01&end=2026-04-16&sources=sellrocket,google_ads,criteo,ga4,pinterest"

# Monitoruj progres:
curl -sS "https://$DOMAIN/api/admin/sync-status?key=$CRON_SECRET" | jq .
```

---

## 3. Monitoring

### Health
```bash
curl https://<DOMAIN>/api/health
# {"ok":true,"db":"up","ts":"..."}
```

### Sync status (auth)
```bash
curl "https://<DOMAIN>/api/admin/sync-status?key=$CRON_SECRET" | jq .
```
Zwraca ostatnie 40 wpisów z `sync_runs` + per-source podsumowanie SellRocket (liczba dni z revenue > 0, total orders + revenue).

### Dashboard
`https://<DOMAIN>/` — Podsumowanie. Klient otwiera raz, filtruje okres.

### Logi Railway
Railway → service → Logs (live tail). Cron logi zaczynają się `[cron] ...`, backfill `[backfill] ...`.

---

## 4. Troubleshooting

### Cron zwraca `Unauthorized`
`?key=` w URL nie zgadza się z `CRON_SECRET` w Variables. Sprawdź.

### `/api/data/*` zwraca `{"error":"No cache — run /api/cron/sync"}`
Rollup jeszcze nie zbudował cache. Odpal ręcznie:
```bash
curl -X POST "https://<DOMAIN>/api/cron/sync?key=$CRON_SECRET"
```
Cron następnie odświeża co 30 min.

### Dashboard pokazuje 0 zł przychodu dla Shopera
SellRocket sync jeszcze nie pobrał danych za wybrany okres. Sprawdź `/api/admin/sync-status` → `sellrocket.shr.nonzero_days`. Jeśli 0, odpal backfill (sekcja 2.7).

### Builds fails na Railway: `ERR_PNPM_OUTDATED_LOCKFILE`
Push najnowszego `pnpm-lock.yaml`. Lokalnie: `pnpm install && git add pnpm-lock.yaml && git commit -m "fix lockfile" && git push`.

### Healthcheck timeout
DB pool nie puszcza. Zmień `DATABASE_URL` na internal Railway URL (`postgres.railway.internal:5432`) zamiast `proxy.rlwy.net` — szybciej w sieci Railway.

### SellRocket sync timeoutuje na cron (>5 min)
Nie powinno — cron synchronizuje tylko `yesterday + today` (2 zapytania × ~20s). Jeśli jednak widzisz timeout, zmień w cron zakres na `?last=1` albo zmniejsz w kodzie `sellRocketRange` w `/api/cron/sync/route.ts`.

### Meta pokazuje tylko 1 dzień danych
MCP server Meta Ads nie wspiera arbitralnych zakresów — tylko presety (`yesterday`, `last_7d` itd.). Sync odpala `yesterday` + `today` za każdym cron'em, więc historia buduje się stopniowo (dzień po dniu).

---

## 5. Referencyjne dane do weryfikacji

Po zakończeniu backfillu marca, sprawdź `/api/data/sales-channels?period=last_30d` w panelu → sekcja `salesBySource`:

| Marzec 2026 | Referencja | Akceptowany błąd |
|---|---|---|
| Shoper (SHR) | `2 985 968,37 zł` | ±1% |
| Allegro (ALL) | `2 402 441,89 zł` | ±1% |

Lokalnie: `node --env-file=.env.local --import=tsx scripts/verify-march.ts`.

---

## 6. Skills chain użyty

- `superpowers:executing-plans` — faza po fazie
- `superpowers:test-driven-development` — Phase 2 (periods.ts, format.ts)
- `frontend-design:frontend-design` — Phase 6-8
- `superpowers:verification-before-completion` — przed commitami

---

## 7. Lista rzeczy do zrobienia **PO Twojej stronie** (user-action)

- [ ] Railway → New service → GitHub repo (sekcja 2.2)
- [ ] Railway → Variables (sekcja 2.3)
- [ ] Generate public domain (Networking)
- [ ] Lokalnie: `node scripts/db-migrate.ts` ze zmienionym DATABASE_URL (sekcja 2.4)
- [ ] Check `/api/health` w przeglądarce
- [ ] Cron Schedule (sekcja 2.6)
- [ ] Opcjonalnie: backfill marca (sekcja 2.7)
- [ ] Otwórz dashboard URL w przeglądarce i sprawdź KPIs

Każdy z tych kroków trwa <5 min.
