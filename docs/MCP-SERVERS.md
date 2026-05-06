# MCP Servers — Room99

Dashboard zaciąga dane z platform reklamowych przez **MCP (Model Context Protocol)**. Każda platforma ma własny serwer MCP hostowany na Railway w workspace **MarketingHackers**. Klient MCP w aplikacji żyje w `src/lib/sync/mcp-client.ts` (wrapper na `@modelcontextprotocol/sdk` z retry + timeout). Każdy `src/lib/sync/<platform>.ts` to cienka warstwa: connect → call tool → upsert do bazy.

---

## Dlaczego MCP, a nie bezpośredni SDK platformy?

- **Izolacja OAuth** — każda platforma ma własny serwer, swój zestaw credentiali, własny refresh token. Nie wkładamy 5 setów uprawnień w jedną aplikację Next.js.
- **Reużywalność cross-client** — Marketing Hackers ma kilkanaście klientów, każdy z własnym kontem Meta/Google. MCP serwery są bezstanowe per-call (account ID idzie w argumentach), więc ten sam serwer obsługuje wszystkich.
- **Koszt** — dashboard NIE woła Claude'a podczas synchronizacji. MCP server tylko proxowuje API platformy. Jedyne wywołanie LLM-a to ad-hoc parsery (np. `sku-parser.ts` używa Haiku do klasyfikacji nieznanych SKU — ~$0.001/sync).
- **Resilience** — gdy API platformy padnie, restartujemy tylko jeden mały serwer Railway zamiast całego dashboardu.

---

## 5 aktywnych serwerów (w sync flow)

| Serwer | Railway projekt | URL | Tools używane przez sync |
|---|---|---|---|
| Meta Ads | `MCP-Meta` | `https://mcp-meta.up.railway.app/mcp` | `facebook_get_adaccount_insights` |
| Google Ads | `MCP-Ads` | `https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp` | `google_ads_run_query` (GAQL) |
| Criteo | `MCP-Criteo` | `https://mcp-criteo.up.railway.app/mcp` | `get_campaign_stats` |
| GA4 | `MCP-Analytics` | `https://mcp-analytics.up.railway.app/mcp` | `run_report`, `get_traffic_sources`, `get_ecommerce_report` |
| BaseLinker (proxy) | `MCP-SellRocket` | `https://mcp-sellrocket.up.railway.app/mcp` | `get_daily_revenue`, `get_products_sold`, `list_orders` |

### Transport

Większość serwerów używa już **streamable HTTP** (nowszy transport). Niektóre wciąż na **SSE** (legacy) — `mcp-client.ts` automatycznie negocjuje. Historycznie Criteo i GA4 były na SSE; **Criteo migrowane na HTTP** w `d52ab7b` (SSE wieszało się przy >60s requestach).

### Auth

OAuth/API keys per-platform są skonfigurowane **wewnątrz każdego serwera MCP**. Tokens są w Railway Variables tego konkretnego serwera (np. `META_USER_ACCESS_TOKEN` w `MCP-Meta`, `GOOGLE_ADS_OAUTH_REFRESH_TOKEN` w `MCP-Ads`, `BASELINKER_API_TOKEN` w `MCP-SellRocket`). Aplikacja `nextjs-web` **nie zna tych tokenów** — wysyła tylko account ID i parametry zapytania.

---

## 2 serwery w standby (gotowe, nieużywane w bieżącym sync)

| Serwer | Railway projekt | URL | Status |
|---|---|---|---|
| Pinterest | `MCP-Pinterest` | `https://mcp-pinterest.up.railway.app/mcp` | Standby — Pinterest synchronizujemy via ręczny upload CSV (Windsor.ai). Można przełączyć na MCP, jeśli chcesz natywne API. |
| Search Console | `MCP-SearchConsole` | `https://mcp-searchconsole.up.railway.app/mcp` | Standby — naturalna następna funkcjonalność (zakładka SEO). |
| Google Merchant Center | `MCP-Google-Merchant-Center` | `https://mcp-google-merchant.up.railway.app/mcp` | Standby — przyszła zakładka feed-quality. |

---

## Niezawodność: Railway vs Vercel

Dashboard był pierwotnie na Vercel. **Migrowany na Railway** (jeden z pierwszych commitów po reorganizacji), bo:

- Vercel functions czasem dostawały **HTTP 500 z Anthropic API** (problem z IP range Vercela rozwiązywany przez Anthropic — nieprzewidywalne flake).
- Vercel Cron ma 10-sekundowy hard limit (free) / 60s (pro). Nasz sync trwa 2–4 min — nie da się.
- Railway daje stałą maszynę z public IP, dłuższy timeout (300s), prostsze logi.

MCP serwery na Railway **nigdy nie miały problemu z Anthropic API z perspektywy klienta MCP**, bo to nie one wołają Claude'a — proxują API platformy.

---

## Jak dodać nowy MCP-synchronizowany serwis (~6 kroków)

Załóżmy: chcesz dodać Klaviyo (newslettery).

1. **Postaw serwer MCP-Klaviyo** na Railway. Najprościej — Anthropic ma katalog gotowych. Albo własna implementacja (zob. `mcp-builder` skill jeśli pracujesz z Claude Code).
2. **Skonfiguruj OAuth/API key** na tym Railway serwisie. Otrzymujesz publiczny URL `https://mcp-klaviyo.up.railway.app/mcp`.
3. **Sprawdź narzędzia** lokalnie:
   ```bash
   node --env-file=.env.local --import=tsx scripts/probe-mcp.ts https://mcp-klaviyo.up.railway.app/mcp
   ```
   Skrypt wypisze listę dostępnych tooli i ich schema.
4. **Dodaj `MCP_KLAVIYO_URL`** do `.env.example`, `.env.local` i Railway Variables w `nextjs-web`.
5. **Stwórz `src/lib/sync/klaviyo.ts`** wzorując się na `criteo.ts` lub `meta.ts`:
   ```ts
   import { connectMCP, callMCPTool } from './mcp-client';
   const MCP_URL = process.env.MCP_KLAVIYO_URL!;
   export async function syncKlaviyo(range: DateRange) {
     const client = await connectMCP(MCP_URL, 'http');  // lub 'sse'
     try {
       const data = await callMCPTool(client, 'get_campaign_metrics', {
         start_date: range.start, end_date: range.end,
       }, { retries: 3, initialBackoffMs: 1000 });
       // normalize → upsert do nowej tabeli `klaviyo_daily`
     } finally { await client.close(); }
   }
   ```
6. **Podepnij pod cron** w `src/app/api/cron/sync/route.ts` (dodaj do `SOURCE_TIMEOUT_MS` i wywołanie w bloku `runWithTracking`). Dodaj migrację dla nowej tabeli (zob. `drizzle/`). TDD per `mcp-client.test.ts` jako wzór.

Najczęstsza pułapka: **transport**. Jeśli serwer wisi przy `connectMCP(url, 'sse')`, zmień na `'http'` (lub odwrotnie). `mcp-client.ts` ma 3-retry exponential backoff, ale jeśli transport jest zły, retries nic nie pomogą.
