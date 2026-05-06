# Credentials — gdzie co jest

> **Repo NIE zawiera żadnych sekretów.** Powtarzam: **REPO JEST PUBLICZNE** (`marketinghacker/room99-dashboard-analytics`). Nigdy nie commituj `.env.local`, kluczy API, tokenów, haseł. Cały plik `.env.local` jest w `.gitignore`.
>
> Jeśli przypadkiem zacommitujesz sekret — natychmiast go zrotuj na panelu (Railway → Variables → New value), zrób force-rebuild, i daj znać Marcinowi.

---

## Skąd brać każdy sekret

| Co | Gdzie żyje | Kto daje dostęp |
|---|---|---|
| `DATABASE_URL` (lokalnie) | Railway → projekt `room99-dashboard-sync` → service **Postgres** → tab "Connect" → **Public Network** URL (host: `mainline.proxy.rlwy.net`) | Marcin (Railway team invite) |
| `DATABASE_URL` (produkcyjnie) | Railway auto-injectuje przez plugin Postgres do `nextjs-web` — NIC nie kopiujesz | (auto) |
| `CRON_SECRET` | Railway → `nextjs-web` → Variables. Random 64-char hex — nie próbuj zgadnąć, weź z dashboardu | Marcin |
| `SESSION_SECRET` | Railway → `nextjs-web` → Variables. Min. 32 znaki. JWT signing key | Marcin |
| `ADMIN_PASSWORD` | Railway → `nextjs-web` → Variables. Domyślnie `room99admin`, Marcin mógł zmienić | Marcin |
| `BASELINKER_API_TOKEN` | Railway → `nextjs-web` → Variables. Też w panelu BaseLinker → konto `marcin.marketinghackers` → Moje API | Marcin (lub bezpośrednio z panelu BaseLinker, jeśli masz tam konto) |
| `MCP_*_URL` (5 sztuk) | Już w `.env.example` w repo — to PUBLICZNE adresy Railway, nie sekrety | (już masz) |
| `META_ACCOUNT_ID`, `GOOGLE_ADS_CUSTOMER_ID`, `CRITEO_ADVERTISER_ID`, `GA4_PROPERTY_ID` | Już w `.env.example` — patrz niżej | (już masz) |
| Anthropic API key (do MCP) | Anthropic Console → marcin@marketing-hackers.com. **Zazwyczaj NIE potrzebujesz** lokalnie — MCP-y mają własne | Marcin (przez zaproszenie do org Anthropic) |
| Klucze platformowe (Meta access token, Google Ads OAuth, Criteo client/secret, GA4 service account, Pinterest) | NIE w repo, NIE w `nextjs-web`. **Każdy MCP server ma własny zestaw** w swoich Railway Variables (osobne projekty `MCP-Meta`, `MCP-Ads`, etc.) | Marcin (dostęp do tych Railway projektów) |

---

## Account IDs (PUBLIC-safe — wolno mieć w repo)

To NIE są sekrety, tylko identyfikatory kont. Każdy z dostępem do panelu reklamowego i tak by je zobaczył. Trzymane są w `.env.example` jako fallbacki.

```
Meta Ads:        act_295812916
Google Ads:      1331139339
Criteo:          55483
GA4 property:    315856757
BaseLinker user: marcin.marketinghackers   (login, nie token)
```

W kodzie używaj zawsze `process.env.<ID>` — fallback w kodzie jest jedynie dla devów lokalnych.

---

## Jak skopiować env z Railway na lokal

Najszybciej Railway CLI:

```bash
# 1. Zainstaluj raz (Mac):
brew install railway

# 2. Zaloguj:
railway login

# 3. Linkuj się z projektem (z katalogu repo):
railway link
# → wybierz workspace MarketingHackers
# → wybierz projekt room99-dashboard-sync
# → wybierz service nextjs-web

# 4. Pobierz wszystkie zmienne jako JSON:
railway variables --json > /tmp/vars.json

# 5. Skonwertuj do .env.local (uważaj — to nadpisze!):
node -e "const v=require('/tmp/vars.json'); for(const [k,val] of Object.entries(v)) console.log(\`\${k}=\${val}\`)" > .env.local

# 6. Wymaż /tmp/vars.json (zawiera CRON_SECRET, BASELINKER_API_TOKEN):
rm /tmp/vars.json
```

Alternatywa (klikana): Railway dashboard → `nextjs-web` → Variables → "Raw editor" → copy-paste do `.env.local`.

---

## Co realnie potrzebujesz lokalnie

Minimal do dev servera:

- **`DATABASE_URL`** — public proxy z Railway Postgres (otwarte połączenie z Twojej maszyny)
- **`CRON_SECRET`** — tylko jeśli testujesz `/api/cron/sync` lokalnie
- **`SESSION_SECRET`** — tylko jeśli testujesz logowanie (możesz wkleić dowolne 32+ znaki, np. `openssl rand -hex 32`)
- **`ADMIN_PASSWORD`** — tylko dla `/admin/*`

Reszta (`MCP_*_URL`, account IDs) jest już w `.env.example` — wystarczy `cp`. **Nie potrzebujesz Anthropic API key lokalnie**, jeśli tylko czytasz dane — MCP-y autoryzują się po swojej stronie na Railway.

---

## Bezpieczeństwo: rotacja sekretów

Jeśli kiedykolwiek podejrzewasz wyciek (np. przypadkowy commit, screen w demie):

1. **Railway → Variables** → wygeneruj nowy `CRON_SECRET` / `SESSION_SECRET`. Save → service auto-redeployuje.
2. **`BASELINKER_API_TOKEN`** — panel BaseLinker → API → revoke + create new → wklej do Railway.
3. **Anthropic API key** — Anthropic Console → API keys → revoke + create.
4. **MCP OAuth tokens** (Meta, Google Ads, Criteo) — w odpowiednim Railway projekcie MCP-Meta/MCP-Ads/MCP-Criteo → re-authorize flow.
5. Daj znać Marcinowi.

Wszystko, co masz na lokalu w `.env.local`, traktuj jak hasło: nie wysyłaj mailem, nie wklejaj na Slacka.
