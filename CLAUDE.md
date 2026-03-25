# Quantis — Development Guide

## Project Structure
Monorepo with npm workspaces:
- `client/` — React 18 + Vite + TypeScript + Tailwind CSS frontend
- `server/api-gateway/` — Express + Socket.IO API server (port 3001)
- `server/data-collector/` — Exchange WebSocket data collection (port 3002)
- `server/analysis-engine/` — Indicator calculation & signal generation (port 3003)
- `server/alert-service/` — Alert evaluation & notification delivery (port 3004)
- `shared/` — Shared TypeScript types, constants, utilities
- `database/` — SQL migrations and seed scripts

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, Zustand, TanStack Query, Socket.IO Client, TradingView Lightweight Charts
- **Backend:** Node.js 20, Express, Socket.IO, PostgreSQL + TimescaleDB, Redis, Bull queues
- **Auth:** JWT (access + refresh tokens), bcrypt
- **Payments:** NOWPayments (crypto-only)
- **AI:** Anthropic Claude API

## Commands
- `npm run dev` — Start all services in development
- `npm run docker:up` — Start Docker containers (Postgres + Redis)
- `npm run db:migrate` — Run database migrations
- `npm run build` — Build all packages
- `npm run lint` — ESLint check
- `npm run format` — Prettier format

## Design System
Premium dark theme:
- Primary/Gold: #C9A84C
- Bronze: #CD7F32 (accent for badges, CTAs, highlights)
- Background: #0B0E11
- Surface: #141821
- Success/Green: #0ECB81
- Danger/Red: #F6465D
- Text Primary: #EAECEF
- Text Secondary: #848E9C

## Key Conventions
- All SQL uses parameterized queries (never string interpolation)
- API responses use `ApiResponse<T>` type from shared package
- WebSocket events defined in `shared/constants` WS_EVENTS
- Tier-based feature gating via `requireTier()` middleware
- i18n: English primary, Ukrainian and Russian planned
- All monetary values stored as NUMERIC in PostgreSQL

## Documentation
All docs in `docs/` directory:
- `docs/spec/EN/` — Full platform specification (3 docx files, 80+ sections)
- `docs/spec/UA/` — Ukrainian user guides (8 markdown files)
- `docs/setup/` — Setup guides (quick start, env vars, database, Docker, API keys, deploy)
- `docs/testing/` — Manual testing guides (auth, charts, trading, API curl tests)

## Recent Features
- **Merged pages:** Individual pages consolidated into tabbed views:
  - `/advanced-patterns` — Elliott Wave + Harmonic Patterns + Wyckoff (tabs)
  - `/advanced-charts` — Renko + Market Profile + Order Flow (tabs)
  - `/on-chain` — Dev Activity + Network Metrics (tabs)
  - `/social-intelligence` — Narratives + Influencer Tracker (tabs)
- **New pages:**
  - `/arbitrage` — Arbitrage Scanner (cross-exchange, funding rate, triangular, DEX-CEX)
  - `/backtester` — Strategy Backtester (preset + custom strategies, equity curve, stats)
  - `/grid-bot` — Grid Bot (price range grid trading with simulation)
- **Arbitrage enhancements:**
  - Fee accounting — taker fees per exchange (Binance 0.1%, Bybit 0.1%, OKX 0.08%), net profit calculation
  - DEX-CEX arbitrage — 4th type via DexScreener free API, 10 tokens, circuit breaker, Redis cache
  - Arbitrage alerts — POST endpoint + UI modal for spread/funding/dex_cex threshold alerts
- **AI Copilot:**
  - Morning Brief — daily AI market summary (gainers/losers, trade ideas, key levels)
  - Cached per user for 30 minutes, rate-limited to 1/hour
- **Portfolio analytics:**
  - GET /api/v1/portfolio/analytics — Sharpe ratio, max drawdown, win rate, profit factor
  - Equity curve chart, monthly returns bars, best/worst trade
  - Computed from paper_trades data
- **Quick price alerts:**
  - Bell icon on watchlist cards, one-click "alert above/below" creation
- **i18n:** English, Ukrainian, German, Spanish now available
- Old individual routes redirect to merged pages with appropriate `?tab=` parameter

## API Endpoints (New)
- `GET /api/v1/market/arbitrage/dex-cex` — DEX vs CEX price comparison (DexScreener + ticker cache)
- `POST /api/v1/market/arbitrage/alerts` — Create arbitrage-specific alerts
- `GET /api/v1/copilot/morning-brief` — AI-generated daily market summary
- `GET /api/v1/portfolio/analytics` — Portfolio performance metrics from paper trades

## Admin Panel
Tabbed admin interface at `/admin` with 4 sections:
- **Overview** — Stats cards (users, MRR, ARR, signals), user growth chart, tier distribution
- **Users** — Search/filter/pagination, user detail modal (subscriptions, payments, PnL), ban/delete
- **Revenue** — Real MRR/ARR from payments table, daily revenue chart, payments list, subscriptions overview
- **System** — DB/Redis health, data collector monitor (exchange lag/status), candle counts

### Admin API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/dashboard` | GET | Overview stats + real revenue |
| `/api/v1/admin/users` | GET | Users with search/filter/pagination (?search, ?tier, ?page, ?limit) |
| `/api/v1/admin/users/:id` | GET | User detail (profile, subscriptions, payments, alerts, PnL) |
| `/api/v1/admin/users/:id/tier` | PUT | Change user tier |
| `/api/v1/admin/users/:id/ban` | PUT | Ban/unban user ({action: 'ban'|'unban'}) |
| `/api/v1/admin/users/:id` | DELETE | Soft delete user |
| `/api/v1/admin/revenue` | GET | MRR, ARR, growth %, daily breakdown |
| `/api/v1/admin/revenue/payments` | GET | Payments list (?status, ?page, ?limit) |
| `/api/v1/admin/revenue/subscriptions` | GET | Subs overview, churn rate, expiring soon |
| `/api/v1/admin/analytics/user-growth` | GET | Daily registrations (90 days) |
| `/api/v1/admin/analytics/tier-distribution` | GET | Users per tier |
| `/api/v1/admin/analytics/collector-status` | GET | Exchange lag, last tick, status |
| `/api/v1/admin/system` | GET | DB + Redis health |

### Admin Access
- Controlled via `ADMIN_EMAILS` env var (comma-separated)
- Default: `andriipushkar@gmail.com`
- Backend: `requireAdmin()` middleware checks email against env list
- Frontend: `user.is_admin` flag from GET /auth/me

## External APIs
- **DexScreener:** `https://api.dexscreener.com/latest/dex` — Free, no API key, rate-limited
- **Binance Futures:** `https://fapi.binance.com/fapi/v1` — Funding rates, premium index
- **Bybit:** `https://api-testnet.bybit.com/v5/market` — Funding rates, tickers
- **Anthropic Claude:** `https://api.anthropic.com/v1/messages` — AI analysis (requires ANTHROPIC_API_KEY)
