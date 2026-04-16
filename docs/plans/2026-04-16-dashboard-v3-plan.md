# Room99 Dashboard v3 — Complete Rebuild Plan

## Problem
Dashboard v2 is a mess of half-measures: Vercel + Neon + Railway mixed, broken design, non-functional date picker, data not syncing. User wants ONE platform, premium design, working interactivity.

## Decision: EVERYTHING on Railway
- **Frontend**: Static HTML dashboard served from Railway (or keep Vercel for CDN only)
- **Database**: Railway Postgres (NOT Neon — drop it)
- **Sync Worker**: Railway service with cron (already deployed at project defafc8d)
- **MCP Connector**: Anthropic API calls from Railway (proven to work from Railway IPs)

## Architecture
```
Railway Project: room99-dashboard-sync
├── Service: sync-worker (Node.js, cron every 30 min)
│   └── Calls MCP servers → writes to Railway Postgres
├── Service: Railway Postgres
│   └── dashboard_data table (platform, period_key, data JSONB)
└── (Optional) Service: dashboard-api (serves API for frontend)

Vercel (CDN only):
└── Static dashboard.html with fetch() to Railway API
    OR move entirely to Railway
```

## Reference HTML
File: /Users/marcinmichalski/Downloads/room99-dashboard-korekta 19.02.html (2643 lines)
- 10 tabs: Executive Summary, Performance Marketing, Google Ads, Meta Ads, Pinterest, Criteo, Katalogi, Lejek, Źródła Ruchu, TOP Produkty
- Looker Studio style: white cards, #f0f2f5 bg, blue accents, 28px bold values
- Platform badges, campaign type badges, scorecard widgets
- Filter bar with period + comparison selectors

## Design Requirements (from user)
- MUST match reference HTML 1:1 in structure and data
- Apple/Nike level polish — not generic AI slop
- Functional date picker that changes data
- All tabs must work and show real data
- COS (Cost of Sale) instead of ROAS at summary level
- Meta Ads account: act_295812916 (NOT act_1182539112713219)
- Google Ads customer: 1331139339

## MCP Server URLs (verified working)
- GA4: https://mcp-analytics.up.railway.app/mcp
- Google Ads: https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp
- Meta Ads: https://mcp-meta.up.railway.app/mcp
- Criteo: https://mcp-criteo.up.railway.app/mcp
- BaseLinker: https://mcp-sellrocket.up.railway.app/mcp (needs account config — skip for now)

## API Key
Stored in: /Users/marcinmichalski/Downloads/room99-dashboard-analytics/.dashboard-config.json

## Current State
- Railway project created: defafc8d-d33f-4bde-93b9-3f9dc8eafa81
- Sync worker deployed (needs env vars verified)
- Neon DB has data from successful local sync (sessions=133505, spend=93562)
- GitHub repos: marketinghacker/room99-dashboard-analytics, marketinghacker/room99-sync-worker

## Implementation Steps
1. Create Railway Postgres in room99-dashboard-sync project
2. Update sync worker to use Railway Postgres connection string
3. Verify sync worker runs and populates data
4. Rebuild dashboard.html as premium standalone with:
   - All 10 tabs from reference
   - Live fetch from API endpoints
   - Functional date picker (presets: this_month, last_month, last_7d, last_30d)
   - Each preset maps to a period_key in the DB
5. Use /frontend-design skill for Apple-level polish
6. Use /build-dashboard skill for Chart.js integration
7. Deploy everything on Railway
8. Test all tabs, verify data accuracy
