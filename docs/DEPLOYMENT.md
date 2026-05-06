# Deployment — Room99 Dashboard

> Production runs on Railway. Single environment (no staging — agencja, nie SaaS). Push do `main` → Railway widzi, builduje, deployuje. Custom domain rozwiązuje na service `nextjs-web`.

---

## Railway setup

**Workspace:** `MarketingHackers`
**Project:** `room99-dashboard-sync` (ID: `defafc8d-d33f-4bde-93b9-3f9dc8eafa81`)
**Region:** Frankfurt (`eu-central`)

Project ma **3 services**:

1. **`nextjs-web`** — sama aplikacja Next.js. Uruchamia `pnpm start` po buildzie. Nasłuchuje na `$PORT` (Railway zarządza). Domena: `room99.marketing-hackers.com`.
2. **`Postgres`** — Railway Postgres plugin (managed). Auto-injectuje `DATABASE_URL` do `nextjs-web`. Public proxy URL (`mainline.proxy.rlwy.net`) do dev-połączeń lokalnych.
3. **`cron-sync`** — minimalistyczny kontener (curl/cron) ticker. Co 5 min puka w `/api/cron/sync`. **Środowisko współdzielone z `nextjs-web`** (env vars dziedziczone w obrębie projektu) — `CRON_SECRET` widzą oba serwisy bez kopiowania.

---

## Auto-deploy z GitHub

Railway watchuje branch `main`:

1. Robisz `git push origin main`.
2. Railway dostaje webhook od GitHub.
3. Builduje: `pnpm install && pnpm build` (Turbopack). Build trwa ~2–3 min.
4. Po buildzie healthcheck `GET /api/health` (musi zwrócić 200 w ciągu 60s, bo inaczej rollback).
5. Jeśli zielone → traffic switch (rolling). Jeśli czerwone → poprzedni deployment zostaje.

**Brak staging environment.** Jeśli boisz się merge-do-main, otwórz PR (Railway buduje preview deployment dla każdego PR, jeśli jest to skonfigurowane — sprawdź w Railway dashboard project settings).

---

## Custom domain

`room99.marketing-hackers.com` jest skonfigurowane w Railway → `nextjs-web` → Settings → Domains. CNAME w DNS Marketing Hackers wskazuje na Railway-provided domain (`*.up.railway.app`). SSL automatycznie via Let's Encrypt.

Jeśli kiedyś potrzebujesz zmienić domenę — dodaj nową, zaktualizuj DNS, poczekaj na cert, usuń starą.

---

## Cron container (`cron-sync`)

Konfiguracja:

- **Image**: prosty kontener z `cron` lub `supercronic`. Schedule: `*/5 * * * *`.
- **Command**: `curl -fsS "$TARGET_URL"` lub `wget -qO- "$TARGET_URL"`.
- **Env**:
  - `TARGET_URL=https://room99.marketing-hackers.com/api/cron/sync?key=$CRON_SECRET`
  - `CRON_SECRET` — dziedziczony z projektu, ten sam co w `nextjs-web`.

**Throttle endpoint, NIE cron**: cron co 5 min, ale `/api/cron/sync` skipuje jeśli ostatni successful run był < 25 min temu. Efektywny rate ~25–30 min. Plus: gdy pojedynczy tick padnie (Meta wreq fail), następny już za 5 min — szybsza recovery.

---

## Monitoring i healthchecks

| Endpoint / źródło | Co sprawdza |
|---|---|
| `GET /api/health` | Liveness (zwraca 200 jeśli proces żyje + DB jest reachable). Używany przez Railway healthcheck. |
| `GET /api/data/sync-heartbeat` | Ostatni successful sync per source. Surowy JSON, czytelny w przeglądarce. |
| `/admin/sync-status` (po zalogowaniu jako agency) | UI: tabela `sync_runs` ostatnie 200 wpisów, kolory per status. |
| `railway logs --service nextjs-web --tail` | Live tail logów aplikacji. Filtruj `grep criteo`, `grep ERROR`. |
| `railway logs --service cron-sync --tail` | Live tail cron container — widzisz curle co 5 min. |
| `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 20` | Pełna historia — najpewniejsze źródło prawdy. |
| Sentry (jeśli `SENTRY_DSN` ustawiony) | Errory backendowe i frontendowe. Marcin trzymał wyłączone do MVP. |

**Alerty**: brak (świadomie). Marcin sprawdza dashboard parę razy dziennie. Jeśli chcesz — Railway potrafi mailować przy crash, ale flaky platform requests nie powinny budzić w nocy.

---

## Rollback

**Najszybciej** — Railway dashboard:

1. Otwórz projekt → service `nextjs-web` → tab "Deployments".
2. Znajdź ostatni działający deployment (zielony status).
3. Kliknij `...` → "Redeploy".
4. Railway buduje od nowa z tego commita i deployuje. ~2 min.

**Wariant via git** (jeśli Railway dashboard nie odpowiada):

```bash
git revert <bad-commit>
git push origin main
# Railway widzi nowy push i deployuje wersję z revertem.
```

**NIE rób `git reset --hard origin/main~1 + push --force`** na main. Force push do main jest zablokowany przez branch protection (jeśli jest skonfigurowane), ale nawet bez tego — niszczysz historię, a CI/CD nie ma alternatywnego źródła prawdy.

---

## Database migrations

Migracje Drizzle są **idempotentne** — `scripts/db-migrate.ts` używa `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. Re-uruchomienie nie psuje stanu.

**Procedure**:

1. Lokalnie: edytuj `src/lib/schema.ts`, dodaj nowe pole/tabelę.
2. `pnpm db:generate` → Drizzle generuje SQL w `drizzle/<n>_<name>.sql`. Sprawdź ręcznie — czy nie usuwa kolumn?
3. Test migracji lokalnie:
   ```bash
   node --env-file=.env.local --import=tsx scripts/db-migrate.ts
   ```
   Łączy się z public proxy → wykonuje migrację na PROD-Postgres. Tak — **dev używa tej samej bazy co prod**, bo single-tenant. Jeśli to Cię stresuje, zrób backup snapshot przed (Railway → Postgres → Backups → manual snapshot).
4. Commit + push. Railway zbuduje, ale **nie uruchomi migracji automatycznie** (świadomie — chcemy ręcznej kontroli). Po deploy:
   ```bash
   railway run --service nextjs-web -- node --import=tsx scripts/db-migrate.ts
   ```
   lub uruchom z lokalnego env (bo public proxy działa).

**Większe migracje** (rename column, drop table): pisz ręcznie SQL, testuj na backupie najpierw.

---

## Backupy

Railway Postgres robi automatyczne backupy (Railway Pro). Manual snapshots: Postgres service → Backups → "Create snapshot". Restore: pojedynczy klik. Test restore robiłem ostatnio nigdy — warto raz w roku zrobić ćwiczenie disaster recovery.

---

## Co potrafi pójść nie tak (i jak naprawić)

- **Build fail na Turbopack** (`pnpm build`): zwykle nieuczciwy import / krzywy typ. Lokalnie: `pnpm build` musi przejść przed pushem. Backup: zmień `next build` na `next build --webpack` w `package.json` na ostatnią deske ratunku.
- **Healthcheck fail**: zwykle DB nie odpowiada (Postgres restart, zła `DATABASE_URL`). Sprawdź `railway logs --service nextjs-web` zaraz po deploy.
- **Cron przestał strzelać**: `cron-sync` service crashed. Restart w Railway dashboard. Sprawdź `cron-sync` logs.
- **Domena nie działa**: zwykle DNS. `dig room99.marketing-hackers.com` — czy CNAME pokazuje na railway. Jeśli nie, ktoś zmienił DNS u Marketing Hackers — pytaj Marcina.
