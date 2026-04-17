# Dashboard v2 — Holistic Fix Design

**Data:** 2026-04-17
**Status:** APPROVED by Marcin (brainstorming complete)
**Cel:** Zamknąć wszystkie bugi dokładności danych + dodać deep analytics per-kategoria/kolekcja + real-time + date picker.

## Problem, który rozwiązujemy

Po deploy v1 wyszło **~8 bugów w ciągu 4h** — wszystkie mają ten sam korzeń:

> **Brak jednego źródła prawdy per metryka**. Mieszamy MCP / direct API / aggregate-spread / GA4 legacy.

Konsekwencje:
- Meta `last_30d ÷ 30` = fałszywe daily (każdy dzień = ten sam numer → "dubel 16/17 kwietnia")
- MCP `filter_order_source='ALL'` zwraca tylko 2 z N kont Allegro (dotknięte 7% gap)
- Revenue per platforma pokazuje SHR total (nie attribution Meta)
- Funnel `items_viewed` (product-count) > sessions (session-count)
- Cache nigdy nie invalidate per-date (pokazuje stale SHR 990k zamiast 998k)

## Architektura (po fixach)

### 1. Data contracts — jeden source of truth per metryka

| Metryka | Źródło prawdy | Daily granularity | Real-time |
|---|---|---|---|
| Revenue **Shoper** | BaseLinker direct API, `payment_done`, `filter_order_source='SHR' source_id=9` | ✅ prawdziwy | Webhook |
| Revenue **Allegro** | BaseLinker direct API, `ALL/8` + status_id allow-list (z config) | ✅ | Webhook |
| **Meta** spend/conv | Facebook Graph API bezpośrednio, `time_increment=1` | ✅ | Sync co 5 min |
| **Google Ads** | GAQL `segments.date` (już działa) | ✅ | Sync co 5 min |
| **Criteo** | MCP `get_campaign_stats` + `Day` dimension (już daily) | ✅ | Sync co 5 min |
| **Pinterest** | Windsor.ai `ad_performance_daily` (user-plan 1×/dzień) | ✅ | 24h delay |
| **Sessions/funnel GA4** | `run_report` eventCount × eventName `view_item/add_to_cart/begin_checkout/purchase` | ✅ | Sync co 5 min |

### 2. Zasady egzekucyjne

- **Nigdy aggregate spread** — jeśli platforma nie zwraca daily, pole `is_estimate=true` i UI ukrywa na dziennym chart'cie (tylko sumę okresu)
- **Każdy sync w `sync_runs`** ma `data_freshness` (najświeższa data pobranych danych)
- **Cache invalidation per-date** — rollup dotyka tylko okresów zawierających zsynchronizowane daty

### 3. Real-time pipeline

```
BaseLinker new_order webhook
   ↓ POST /api/webhook/baselinker
   → zapis do sellrocket_daily (insert/upsert dla daty)
   → trigger rollup dla period_key zawierającego tę datę
   → SSE push na /api/live → otwarte przeglądarki dostają fresh dane

Ads platforms sync (5-min cron)
   ↓ /api/cron/sync → syncMeta/Google/Criteo/Pinterest/GA4
   → upsert do ads_daily / ga4_daily / products_daily
   → rollup per-date
   → SSE push
```

**SLA:** nowy order Shoper → widoczny na dashboardzie < **20 sekund**.

## Komponenty do dodania/zmiany

### Backend

- **Nowy:** `src/lib/sync/meta-graph.ts` — direct Facebook Graph API client (`META_GRAPH_API_TOKEN`), `time_increment=1`
- **Nowy:** `src/lib/sync/products.ts` — per-SKU sync z BaseLinker `getOrders`→products, heurystyka `parseSkuToCategoryCollection(name)` 
- **Nowy:** tabela `products_daily` (date, sku, product_name, category, collection, source ∈ {shr, allegro}, quantity, revenue, orders) + PK(date, sku, source)
- **Nowy:** tabela `order_status_config` (status_id, label, is_valid_sale) — user-editable allow-list
- **Nowy:** `src/app/api/webhook/baselinker/route.ts` — endpoint na webhook Baselinker
- **Nowy:** `src/app/api/live/route.ts` — SSE stream emitujący update events
- **Nowy:** `src/lib/sync/ga4-events.ts` — eventCount sync dla view_item/add_to_cart/begin_checkout/purchase
- **Zmiana:** `src/lib/sync/meta.ts` → deprecated (przeniesione do `meta-graph.ts`). Usunąć aggregate-spread.
- **Zmiana:** `src/lib/rollup.ts` → dodać `buildRollups({ onlyDates: string[] })` dla incremental rebuild
- **Zmiana:** `src/lib/sync/sellrocket-direct.ts` → filtr po `is_valid_sale` ze `order_status_config`
- **Zmiana:** `cron-sync` service `railway.json` → `cronSchedule: '*/5 * * * *'`

### Frontend

- **Nowy:** `src/components/ui/DateRangePicker.tsx` — kalendarz z zakresem, wypisuje custom period key
- **Zmiana:** `FilterBar` → opcja "Zakres niestandardowy" otwierająca DateRangePicker
- **Zmiana:** `api.ts/parseFilters` → akceptuje custom period bez cache lookup
- **Zmiana:** `providers.tsx` → SWRConfig `refreshInterval: 30000` + EventSource do `/api/live`
- **Zmiana:** `TopProductsTab` → 3-poziomowy drill-down (Kategoria → Kolekcja → SKU) z YoY + alertami
- **Zmiana:** `PinterestTab` → banner "Dane Pinterest aktualizowane 1×/dziennie przez Windsor.ai"
- **Nowy:** `src/app/admin/statuses/page.tsx` — UI do wyboru which status_id = valid sale

### Alerty (v2 — po kategoriach)

| Alert | Trigger |
|---|---|
| 🔴 Spadek kolekcji | revenue kolekcji 7d < 50% YoY |
| 🟡 Allegro wyprzedza | Allegro > Shoper dla kolekcji w 7d |
| ⚠️ Przeoptymalizowane | > 100 sztuk rok temu w tym okresie, teraz < 10 |
| 🟢 Breakout | > 300% YoY (warto zwiększyć budżet) |

## Data flow diagram

```
                  ┌─────────────┐
                  │  Webhooki   │◄── BaseLinker (nowy order)
                  │             │
                  └──────┬──────┘
                         │
                         ▼
 ┌─────────┐       ┌──────────┐      ┌───────────┐
 │ Direct  │───────▶ sellrocket_daily  products_daily
 │  API BL │       └──────────┘      └───────────┘
 └─────────┘              │                │
                          ▼                ▼
 ┌──────────────┐   ┌──────────────────────────────┐
 │ Facebook     │──▶     ads_daily                 │
 │ Graph (Meta) │   │     + is_estimate flag       │
 └──────────────┘   └──────────────────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ buildRollups │
                   │  per-date    │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │ dashboard_   │
                   │ cache        │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐        ┌─────────┐
                   │   /api/data  │───────▶│   UI    │
                   │   /api/live  │◄──SSE──┤  (SWR)  │
                   └──────────────┘        └─────────┘
```

## Testing plan

- **Unit:** `parseSkuToCategoryCollection()`, `buildRollups({onlyDates})`, `resolvePeriod('custom_...')` (TDD)
- **Integration (live):** each sync module writes real data to Railway staging DB
- **Acceptance:** po deploy SHR za April 1-16 = **998 534 zł ±1%** (reference 999 486)
- **Acceptance:** po deploy Meta April 1-16 = **49 374 zł ±3%** (reference Meta Ads Manager)
- **Acceptance:** po deploy Allegro (z status filter user-picked) = **916 031 zł ±3%** (reference 916 031)
- **Acceptance:** nowy order Shoper (test) → widoczny w `/api/live` SSE stream < 20s

## Kolejność wdrożenia (priorytety)

1. **Quick wins (dziś):**
   - Cron 5 min
   - SWR refresh 30s
   - Cache invalidation per-date
   - Pinterest Windsor banner
   - Delete Meta aggregate-spread (zastąpić Meta Graph API direct)
2. **Day 2:**
   - Date picker custom range
   - Order status config + filter
   - Webhook BaseLinker
   - SSE live push
3. **Day 3:**
   - products_daily + sync
   - Category/collection drill-down
   - YoY + alerty

## Skills chain

- `superpowers:brainstorming` — done ✅
- `superpowers:writing-plans` — next, zadaniowa mapa
- `superpowers:test-driven-development` — dla nowego kodu (parseSku, rollup incremental)
- `superpowers:executing-plans` — faza implementation
- `frontend-design` — DateRangePicker + drill-down UX

## Go/No-Go

**APPROVED przez Marcina: "no dobra, to jedziesz"**
Następny krok: `superpowers:writing-plans` → implementation plan → **deploy bez dalszych pytań**.
