# Claude Code — gotowy prompt na start sesji

> Skopiuj cały blok poniżej i wklej jako pierwszą wiadomość w nowej sesji Claude Code w katalogu repo. Claude wczyta projektową pamięć (CLAUDE.md / AGENTS.md), zsynchronizuje się z dokumentacją i zacznie pracę zgodnie z konwencjami projektu.

---

```
Pracujesz nad dashboardem analitycznym Room99 (klient Marketing Hackers).
Repo jest PUBLICZNE na GitHub (marketinghacker/room99-dashboard-analytics) —
nigdy nie commituj sekretów. Wszystkie creds żyją w Railway.

Kroki przygotowawcze (zrób je teraz, przed czymkolwiek innym):

1. Wczytaj projektową pamięć:
   - CLAUDE.md (linkuje do AGENTS.md)
   - AGENTS.md (Next.js 16 z Turbopack ma breaking changes — czytaj
     node_modules/next/dist/docs/ przed pisaniem nowego kodu)

2. Przeczytaj w tej kolejności:
   - README.md (high-level)
   - docs/HANDOFF.md (full picture — backlog, conventions, history)
   - docs/ARCHITECTURE.md (jeśli pracujesz nad backendem / data flow)
   - docs/MCP-SERVERS.md (jeśli pracujesz nad syncem)
   - docs/DEVELOPMENT.md (workflow + conventions)

3. Pobierz świeży main:
   git pull origin main
   git log --oneline -10
   git tag -l

4. Sprawdź backlog:
   grep -A 30 "## Backlog" docs/HANDOFF.md

5. Sprawdź stan testów (powinno być zielono poza znanymi failami z HANDOFF):
   pnpm tsc --noEmit
   pnpm test

WORKFLOW dla nowej funkcjonalności (obowiązkowy):

a) PRZED kodowaniem zawsze użyj skill `superpowers:brainstorming`. Ta skill
   wymusi zbadanie user intent, requirements i edge cases, zanim napiszesz
   pierwszą linię.

b) Po zatwierdzeniu designu użyj skill `superpowers:writing-plans` —
   plan trafia do docs/plans/YYYY-MM-DD-<feature>-design.md i
   docs/plans/YYYY-MM-DD-<feature>-implementation.md.

c) Wykonaj plan przez `superpowers:subagent-driven-development`. Każdy task
   z planu = jeden conventional commit. Backend logic = TDD obowiązkowe
   (skill `superpowers:test-driven-development`). UI testy opcjonalne.

d) Przed zamknięciem PR-a użyj `superpowers:verification-before-completion` —
   ZAWSZE uruchom testy + typecheck i potwierdź output, zanim oznaczysz coś
   jako gotowe. Evidence > assertions.

e) Dla większych featurów uruchom `superpowers:requesting-code-review`
   przed mergem.

f) Domknięcie: `superpowers:finishing-a-development-branch` (merge/tag/cleanup).

KONWENCJE (krótka ściąga — pełne w docs/DEVELOPMENT.md):

- TypeScript strict, ZERO `any`. `unknown` + type guards.
- Conventional commits: feat(scope): / fix(scope): / chore: / docs: / refactor: / test:
- Polish locale wszędzie:
  - liczby: NBSP + przecinek dziesiętny (formatPLN/formatInt z lib/format)
  - CSV: BOM + średnik
  - tabular-nums dla wszystkich liczb w UI
- Naming: kebab-case dla routes i pure .ts, PascalCase dla React, snake_case w DB
- Time zones: kolumny `date` to "PL day" — zapytania SQL muszą używać
  (date AT TIME ZONE 'Europe/Warsaw')::date jeśli arytmetyka na "today"

REPO JEST PUBLICZNE — żadnych sekretów. Account ID-y są OK (są w .env.example).
Tokeny / hasła / klucze tylko w Railway Variables.

Gdy skończysz przygotowanie, zaproponuj: nad którym punktem z backloga w
docs/HANDOFF.md chcesz pracować, albo poczekaj na nowy task.
```

---

## Tip dla Marcina, gdy oddajesz repo nowej osobie

Wyślij developerowi:

1. Link do repo: https://github.com/marketinghacker/room99-dashboard-analytics
2. Powyższy prompt (cała sekcja w cudzysłowach)
3. Email z prośbą o invite-y wymienione w `docs/HANDOFF.md` ("Co musisz dostać od Marcina")

Tyle. Cała reszta jest w repo.
