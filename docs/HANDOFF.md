# Handoff — Room99 Dashboard

> Witaj w projekcie. Ten dokument to "ground truth" — przeczytaj go w całości
> przed pierwszym commitem. Powinno zająć Ci to 20–30 minut.

**Klient:** Room99.pl (polski sklep z tekstyliami domowymi: zasłony, firany, narzuty, pościele).
**Agencja:** Marketing Hackers (kontakt: marcin@marketing-hackers.com).
**Live:** https://room99.marketing-hackers.com
**Repo:** https://github.com/marketinghacker/room99-dashboard-analytics (PUBLICZNE — żadnych sekretów w kodzie).
**Aktualny tag:** `sales-tree-v1` (ostatnio domknięta funkcjonalność).

---

## Co dostajesz

Pełne, działające środowisko marketingowego dashboardu. Aplikacja w produkcji od kwietnia 2026, obsługiwana 24/7 przez cron. Brak otwartych blokerów.

W repo znajdziesz:

- Aplikację Next.js 16 (App Router, React 19, Turbopack, TS strict, Tailwind v4 inline w `globals.css`).
- 11 zakładek dashboardowych — od podsumowania, przez kanały sprzedaży, po 4-poziomowe drzewo produktów z eksportem CSV/XLSX.
- Synchronizację 5 platform reklamowych przez MCP (Meta, Google Ads, Criteo, GA4, BaseLinker via SellRocket) + 1 ręczny upload (Pinterest CSV).
- Drizzle ORM + Postgres na Railway, idempotentne migracje (`scripts/db-migrate.ts`).
- 35+ plików testowych (Vitest), Playwright e2e w `tests/`.
- 8 dokumentów planistycznych w `docs/plans/` opisujących, jak doszliśmy do bieżącego designu.
- Cron w osobnym kontenerze Railway (nie Vercel — patrz `ARCHITECTURE.md`).

---

## Co musisz dostać od Marcina

Napisz do `marcin@marketing-hackers.com` z prośbą o:

1. **GitHub Collaborator invite** dla repo `marketinghacker/room99-dashboard-analytics` (write access — repo jest publiczne, ale Marcin jest właścicielem).
2. **Railway team invite** do workspace **MarketingHackers** (rola Developer wystarczy do logów i zmiennych; Owner tylko jeśli będziesz tworzyć nowe usługi).
3. **BaseLinker API token** — Marcin trzyma go w Railway → `nextjs-web` → Variables jako `BASELINKER_API_TOKEN`. Jest też w panelu BaseLinker (konto `marcin.marketinghackers`) → API → tokeny.
4. **Anthropic API key** — *zazwyczaj niepotrzebny lokalnie*. MCP-y mają własne dane uwierzytelniające na Railway. Klucz Anthropic potrzebny tylko, jeśli dopisujesz nowy MCP wywołujący Claude (np. parser lub klasyfikator).
5. **Hasło do `/admin/*`** w produkcji — env `ADMIN_PASSWORD` w Railway. Domyślnie `room99admin`, ale Marcin mógł zmienić.

Wszystkie sekrety są w panelach (Railway/GitHub/BaseLinker). **W repo NIE MA żadnych sekretów** — szczegóły w `docs/CREDENTIALS.md`.

---

## Pierwszy dzień (1h checklist)

```bash
# 1. Klon + zależności (5 min)
git clone https://github.com/marketinghacker/room99-dashboard-analytics
cd room99-dashboard-analytics
pnpm install

# 2. Zmienne środowiskowe (10 min)
cp .env.example .env.local
# Otwórz .env.local i wklej DATABASE_URL z Railway (public proxy URL,
#   Railway → Postgres → Connect → Public Network).
# CRON_SECRET, MCP_*_URL i Account ID-y są już w .env.example —
#   tylko DATABASE_URL musisz wkleić ręcznie.

# 3. Migracja bazy (idempotentna — możesz puścić wielokrotnie) (1 min)
node --env-file=.env.local --import=tsx scripts/db-migrate.ts

# 4. Dev server (10 min — eksploruj zakładki) (1 min start)
pnpm dev
# → http://localhost:3000  (login: dowolny user z tabeli `users`,
#   albo zaloguj się jako agency: marcin@marketing-hackers.com / room99admin)

# 5. Testy (5 min)
pnpm test                                    # Vitest, 180+ testów
pnpm tsc --noEmit                            # TypeScript check

# 6. Smoke test pojedynczej platformy (opcjonalne, 5 min)
node --env-file=.env.local --import=tsx scripts/smoke-sync.ts meta
node --env-file=.env.local --import=tsx scripts/smoke-sync.ts criteo

# 7. Sprawdź ostatni stan (5 min)
git log --oneline -20
git tag -l                                   # zobacz `sales-tree-v1`
```

Po tych 7 krokach masz pełne lokalne środowisko.

---

## Architektura w pigułce

```
┌────────────────────────────────────────────────────────────────────┐
│                  MCP servers (Railway, 5 active)                   │
│  meta │ google-ads │ criteo │ analytics(GA4) │ sellrocket(BL)     │
└──────────────┬─────────────────────────────────────────────────────┘
               │ MCP protocol (HTTP streamable / SSE legacy)
               ▼
┌────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (Railway, service `nextjs-web`)                        │
│                                                                    │
│  /api/cron/sync ─► fetchPlatform() ─► upsert ads_daily/ga4_daily   │
│        ▲                                          │                │
│   external                                        ▼                │
│   cron-sync                              buildRollups() ────►──┐   │
│   container                                                    │   │
│                                                                ▼   │
│  /api/data/<tab>  ─► reads dashboard_cache ─► UI (SWR)             │
│  /api/auth/*      ─► JWT login + httpOnly cookie + middleware      │
└──────────────────────┬─────────────────────────────────────────────┘
                       ▼
                 PostgreSQL (Railway, Postgres plugin)
                 ads_daily · ga4_daily · sellrocket_daily ·
                 products_daily · dashboard_cache · sync_runs · users
```

Pełny opis: **`docs/ARCHITECTURE.md`**.

---

## Stan kodu na dziś

- **Ostatni commit na main:** `7ad03f8 feat(sales-tree): ExportModal + wire export button to download` (2026-05-06).
- **Ostatnia funkcjonalność:** Sales Tree (drzewo sprzedaży) — 4 poziomy (kanał → kategoria → kolekcja → produkt), sparkline, fuzzy search (Fuse.js), top-10 collapse, eksport CSV (BOM + średnik + locale PL) i XLSX (2 arkusze + outline groups). 35/35 testów. Tag `sales-tree-v1`.
- **5 commitów wcześniej** załatały błąd okna synchronizacji: `last_Nd` nie obejmował dzisiejszego dnia PL — naprawione w `5a8d08d`/`24a4db5`/`922a800`.

### Znane problemy (NIE wprowadzone przez sales-tree, do osobnego sprzątnięcia):

- `src/components/ui/DateRangePicker.test.tsx` — 2 błędy TS (`r.from` możliwie `undefined`).
- `src/lib/format.test.ts` — 1 fail (NBSP vs ASCII space).
- `src/lib/periods.test.ts` — 4 fails (zahardkodowane fixture daty — testy rozjechały się po zmianie dnia).

Wszystko w kodzie sprzed sales-tree, oznaczone do osobnego cleanupu.

---

## Backlog

### Sales-tree follow-ups (z code-review)

1. Zamiast `Intl.NumberFormat` w komponentach drzewa używać `formatPLN`/`formatInt` z `lib/format.ts` (jednolite formatowanie).
2. CSV-escape **wszystkich** pól tekstowych (obecnie tylko `product_name`).
3. Rozdzielić memo dla buildu indeksu Fuse od memo wyszukiwania — index nie powinien się przebudowywać przy każdym wciśniętym znaku.
4. ARIA `tree`/`treeitem` + focus-trap w `ExportModal` (a11y).
5. Dodać `dashboard_cache` dla `/api/data/sales-tree`, jeśli SQL przekroczy 800 ms na produkcji.

### Inny tech debt

- Naprawić 7 znanych testów (DateRangePicker, format, periods) — patrz wyżej.
- `MCP-SearchConsole` i `MCP-Google-Merchant-Center` istnieją, ale nie są podpięte do sync — naturalna następna funkcjonalność (zakładka SEO).
- Backfill historyczny (przed kwietniem 2026) dla `products_daily` jest częściowy — Marcin uruchamiał ad-hoc skryptem `scripts/sync-sellrocket-range.ts`. Można zrobić UI w `/admin/backfill`.

---

## Jak pracował poprzedni dev (Claude Code)

Cały dashboard powstawał w trybie subagent-driven development. Polecam ten sam flow — sprawdza się dla pojedynczego dewelopera w średnim projekcie:

1. **Brainstorming** (skill `superpowers:brainstorming`) — przed dotknięciem kodu eksploruję user intent, requirements, edge cases.
2. **Writing plan** (skill `superpowers:writing-plans`) — wynik brainstormingu trafia do `docs/plans/YYYY-MM-DD-<feature>-design.md` i `<feature>-implementation.md` (ten drugi to checklist tasków).
3. **Subagent-driven development** (skill `superpowers:subagent-driven-development`) — task po tasku z planu. Każdy task to **jeden commit** (conventional commit), z TDD (skill `superpowers:test-driven-development`) dla kodu backendowego.
4. **Code review** przed mergem — ręczny `git diff origin/main` lub subagent code-reviewer dla większych featurów.
5. **Finishing a development branch** (skill `superpowers:finishing-a-development-branch`) — merge/tag/cleanup.

Wszystkie commity dla sales-tree są podpisane `Co-Authored-By: Claude…` — to zostawiam w `docs/CLAUDE-PROMPT.md` razem z gotowym promptem.

---

## Konwencje

- **TypeScript strict, ZERO `any`.** Używaj `unknown` + type guards.
- **TDD wymagane dla logiki backendowej** (Vitest). Dla UI opcjonalne, ale zachęcane przy nietrywialnych komponentach (sparkline, drzewa).
- **Conventional commits**: `feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `refactor:`, `test:`. Zakresy: `sales-tree`, `cron`, `criteo`, `yoy`, etc.
- **Polish locale wszędzie**:
  - Liczby: NBSP (` `) jako tysiąc-separator, przecinek dziesiętny (`formatPLN`/`formatInt` w `lib/format.ts`).
  - CSV: BOM (`﻿`), separator średnik (Excel PL).
  - Daty: ISO w bazie (`date` UTC północ = "PL day"), w UI `pl-PL`.
  - `font-variant-numeric: tabular-nums` dla wszystkich liczb.
- **Naming**:
  - Routes: `kebab-case` (`/api/data/sales-tree`).
  - Komponenty React: `PascalCase` (`SalesTreeRow.tsx`).
  - Niereaktowe `.ts`: `kebab-case` (`flatten-tree.ts`, `sku-parser.ts`).
- **Repo PUBLIC** — nigdy nie commituj sekretów, nigdy nie hardkoduj account IDs (zawsze `process.env.X || 'fallback-public-id'`).
- **Time zones** — w bazie `date` UTC, ale **traktuj jako PL day**. Zapytania SQL powinny robić `(date AT TIME ZONE 'Europe/Warsaw')::date`. Zob. `ARCHITECTURE.md` → "Time zones".

---

## Następne kroki dla Ciebie

1. Wyklikaj sobie wszystkie 11 zakładek lokalnie — niech intuicja zaskoczy.
2. Przeczytaj jeden plan z `docs/plans/` (polecam `2026-05-06-sales-tree-export-implementation.md`) — pokazuje, jak rozkłada się feature na taski.
3. Zerknij na `src/lib/sync/mcp-client.ts` — to jest serce integracji z platformami.
4. Otwórz `/admin/sync-status` (po zalogowaniu agency) — zobaczysz tabelę `sync_runs` z ostatnimi przebiegami.
5. Przejrzyj backlog i wybierz jedną pozycję do rozgrzewki (proponuję #1: zamiana `Intl.NumberFormat` na `formatPLN`).

Powodzenia. Marcin chętnie odpowie na pytania.
