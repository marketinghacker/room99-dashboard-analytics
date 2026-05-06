# Development — Room99 Dashboard

> Praktyczne instrukcje dewelopowania. Zakładam, że masz już lokalne środowisko z `docs/HANDOFF.md` ("Pierwszy dzień").

---

## Setup (prerequisites)

- **Node 22** (LTS) — `nvm install 22 && nvm use 22`. Inne wersje mogą działać, ale w produkcji jest 22.
- **pnpm 10+** — `npm install -g pnpm`. NPM nie jest wspierany (lockfile to `pnpm-lock.yaml`).
- **gh CLI** — opcjonalne, ale zalecane dla pracy z PR-ami: `brew install gh && gh auth login`.
- **Railway CLI** — `brew install railway` jeśli chcesz pobierać env zmienne / oglądać produkcyjne logi.
- **Postgres klient** — `psql` lub TablePlus jeśli wolisz GUI. Łączenie po public proxy URL z Railway.

```bash
git clone https://github.com/marketinghacker/room99-dashboard-analytics
cd room99-dashboard-analytics
pnpm install
cp .env.example .env.local         # uzupełnij DATABASE_URL z Railway public proxy
node --env-file=.env.local --import=tsx scripts/db-migrate.ts
pnpm dev                           # → http://localhost:3000
```

---

## Konwencje

### TypeScript

- **strict: true**, zero `any`. Jeśli dostajesz nieznany typ — `unknown` + type guard.
- Nie używamy klas — czyste funkcje + typy.
- Drizzle generuje typy z schemy: `import { adsDaily } from '@/lib/schema'` daje typ wiersza za darmo.

### Testy (TDD)

- **Backend logic = TDD obowiązkowe**: agregatory, parsery, periody, formatowanie, eksport, sync logic.
- **UI = opcjonalne**, ale zachęcane dla nietrywialnych komponentów (sparkline, drzewo, filterbar).
- Vitest jest skonfigurowane (`vitest.config.ts`). Testy obok kodu (`foo.test.ts`).
- Skill w sesji Claude Code: `superpowers:test-driven-development` (red → green → refactor, jeden cykl per task).

```bash
pnpm test                                           # all
pnpm vitest run src/lib/sales-tree.test.ts          # single file
pnpm vitest run src/components/tabs/sales-tree/     # single folder
pnpm vitest                                         # watch mode
DATABASE_URL=$(cat .env.local | grep DATABASE_URL | cut -d= -f2-) \
  pnpm vitest run                                   # integration tests touching DB
```

### Conventional commits

Format: `<type>(<scope>): <subject>`. Skopiowane z istniejącej historii:

- `feat(sales-tree): top-10 product collapse with show-more`
- `fix(periods): last_Nd ranges include today (UTC), not just up to yesterday`
- `chore(deps): bump exceljs to 4.4.0`
- `docs: comprehensive handoff documentation for new developer`
- `refactor(sync): extract upsertAdsDaily helper`
- `test(sku-parser): cover Allegro source codes`

Scope sugestywny — najczęstsze: `sales-tree`, `cron`, `criteo`, `meta`, `google-ads`, `ga4`, `sellrocket`, `yoy`, `periods`, `auth`, `admin`, `ui`, `deps`.

### Polish locale

- **Liczby**: NBSP (`U+00A0`) jako tysiąc-separator, przecinek dziesiętny.
  ```ts
  import { formatPLN, formatInt } from '@/lib/format';
  formatPLN(12345.67)  // → "12 345,67 zł"
  formatInt(12345)     // → "12 345"
  ```
  Nie używaj `Intl.NumberFormat` bezpośrednio w komponentach — backlog #1.
- **CSV**: BOM (`'﻿'`) na początku, separator `;`. Pola free-text otoczyć `"` i escape'ować wewnętrzne cudzysłowy. Nigdy nie używaj `,` jako separatora — Excel PL by się rzucił.
- **Daty**: w bazie ISO `YYYY-MM-DD`. W UI `pl-PL` (`Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' })` lub `format(d, 'd MMM yyyy', { locale: pl })` z `date-fns`).
- **Tabular nums**: w `globals.css` mamy `font-variant-numeric: tabular-nums` na `.tnum`/`<table>`/`.metric`. Używaj na każdej cyfrze, żeby kolumny się równały.

### Naming

- **Routes (`src/app/api/...`)**: `kebab-case` w nazwach folderów (`/api/data/sales-tree`, `/api/admin/sync-status`).
- **Komponenty React**: `PascalCase.tsx` (`SalesTreeRow.tsx`, `HeroMetric.tsx`).
- **Pure `.ts` (lib, helpers)**: `kebab-case.ts` (`flatten-tree.ts`, `sku-parser.ts`).
- **Tabele Drizzle**: snake_case w SQL, camelCase w TS (mapowanie w `schema.ts`).

---

## Workflow: dodanie nowej zakładki dashboardu

Załóżmy: chcesz dodać zakładkę "Newslettery" (Klaviyo).

1. **Plan** — `superpowers:brainstorming` → `superpowers:writing-plans` → `docs/plans/YYYY-MM-DD-newsletters-design.md` + `-implementation.md`.
2. **Schema + migracja**: dodaj `klaviyoDaily` do `src/lib/schema.ts`, `pnpm db:generate`, sprawdź `drizzle/<n>.sql`, `pnpm vitest run scripts/db-migrate.test.ts` (jeśli jest).
3. **Sync**: `src/lib/sync/klaviyo.ts` (zob. `MCP-SERVERS.md` → "jak dodać nowy MCP"). Test obok: `klaviyo.test.ts`.
4. **API endpoint**: `src/app/api/data/newsletters/route.ts`:
   ```ts
   export async function GET(req: Request) {
     const { period, compare } = parseFilters(req);
     const data = await getCached(period, 'newsletters', compare);
     return jsonResponse(data);
   }
   ```
5. **UI tab**: `src/components/tabs/Newsletters.tsx` + dodaj do `DashboardShell.tsx` listy tabów + ikonę w `Sidebar.tsx` + pill w `TabNav.tsx`.
6. **Cache**: dopisz `'newsletters'` do `buildRollups()` w `src/lib/rollup.ts`.
7. **Cron**: dodaj `klaviyo` do `Source` type i `SOURCE_TIMEOUT_MS` w `src/app/api/cron/sync/route.ts`.

Każdy z tych 7 kroków = osobny conventional commit.

---

## Workflow: dodanie metryki do istniejącej zakładki

Np. "Avg session duration" do GA4.

1. Test najpierw — `src/lib/rollup.test.ts`: nowy case "buildRollups returns avg_session_duration".
2. Implementacja — w `rollup.ts` dorzuć kolumnę do agregacji (`AVG(session_duration)` z `ga4_daily`).
3. Schema — jeśli kolumna nie istnieje w `ga4_daily`, dodaj migrację (zob. wyżej).
4. UI — w `src/components/tabs/TrafficSources.tsx` dorzuć kafelek `<HeroMetric>` lub kolumnę w `<DataTable>`.
5. Trigger refresh cache: `node --env-file=.env.local --import=tsx scripts/run-rollup.ts` lub `POST /api/admin/rollup`.

---

## Code review (solo dev pattern)

Marcin pracował sam, więc nie ma drugiego dewa do PR-a. Wzorzec:

- **Małe featury (1–3 commity)**: `git diff origin/main` przed `git push`. Czytaj jak ktoś inny — czy nazwa funkcji ma sens? Czy są edge cases? Czy testy faktycznie testują logikę, czy tylko mockują?
- **Duże featury (8+ commitów)**: subagent code-reviewer w Claude Code:
  ```
  > Use superpowers:requesting-code-review to review my sales-tree branch
  > against origin/main.
  ```
  Subagent czyta diff, szuka pułapek, proponuje fixy. Patrz output → nie akceptuj ślepo (skill `superpowers:receiving-code-review` ma zasady weryfikacji feedbacku).
- **Verification before completion** (`superpowers:verification-before-completion`): zanim zapiszesz "feature done", uruchom testy + typecheck + ręczny smoke. Evidence > assertions.

Po reviewu: tag jeśli to milestone (np. `git tag newsletters-v1`), merge do `main`, push, Railway auto-deploy → live.

---

## Debugging produkcji

Najczęstsze problemy:

- **"Sync failed for criteo: timeout"** → `railway logs --service nextjs-web | grep criteo`. Najczęściej OAuth token wygasł. Restart MCP-Criteo w Railway dashboard.
- **"Dashboard pokazuje stare dane"** → sprawdź `/api/data/sync-heartbeat` lub `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 20`. Throttle? Failed run?
- **"Brakuje produktów w sales-tree"** → `scripts/sellrocket-status.ts` → ile dni pokrytych. Backfill: `scripts/sync-sellrocket-range.ts`.
- **"Dziwna kategoria/kolekcja"** → SKU parser się pomylił. Naprawiaj w `lib/sync/sku-parser.ts` (regex) lub uruchom `/api/admin/reclassify-products`.

Skill: `superpowers:systematic-debugging` (formułowanie hipotez przed łataniem).
