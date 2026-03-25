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
  - `/arbitrage` — Arbitrage Scanner (cross-exchange, funding rate, triangular)
  - `/backtester` — Strategy Backtester (preset + custom strategies, equity curve, stats)
  - `/grid-bot` — Grid Bot (price range grid trading with simulation)
- **i18n:** English, Ukrainian, German, Spanish now available
- Old individual routes redirect to merged pages with appropriate `?tab=` parameter
