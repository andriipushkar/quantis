# Quantis

**All-in-One Crypto Technical Analysis Platform**

<!-- ![Quantis Logo](./assets/logo.png) -->

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()

---

## Features

### Analysis
- Real-time interactive charts with 50+ technical indicators
- Multi-chart workspace (up to 9 charts simultaneously)
- AI Copilot for natural-language technical analysis
- Screener with customizable filters and pre-built scans
- Heatmap, correlation matrix, and market breadth dashboard
- Seasonality patterns and funding rate tracker
- Pattern scanner for automated chart pattern detection
- Confluence map overlaying multiple indicator signals
- Open interest and liquidation tracking

### Trading
- Paper trading with virtual $10,000 balance
- Trading journal with emotional state tracking
- DCA bot for automated dollar-cost averaging
- Copy trading to follow top performers
- Anti-liquidation calculator
- Chart replay for backtesting strategies
- Tax reporting with CSV export

### Data
- Token scanner with rug-pull detection heuristics
- Whale alert monitoring for large transactions
- Exchange health dashboard
- Funding rates across major exchanges
- Narrative and sector rotation tracker
- Wallet tracker for on-chain monitoring

### Social
- Community social feed
- Leaderboard and gamification (XP, achievements, streaks)
- Indicator and strategy marketplace
- Referral program

### Security
- JWT-based authentication with refresh tokens
- Tiered subscription access control
- Rate limiting per endpoint category
- Telegram bot integration for alerts

---

## Tech Stack

| Layer          | Technology                                          |
| -------------- | --------------------------------------------------- |
| Frontend       | React 18, TypeScript, Tailwind CSS, Zustand, i18next |
| Backend        | Node.js, Express, TypeScript, Socket.IO             |
| Database       | TimescaleDB (PostgreSQL 16)                         |
| Cache          | Redis 7                                             |
| Infrastructure | Docker Compose, Nginx, GitHub Actions               |

---

## Quick Start

```bash
git clone https://github.com/andriipushkar/quantis.git
cd quantis
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run db:migrate
npm run dev
```

The client runs at `http://localhost:5173` and the API gateway at `http://localhost:3001`.

---

## Architecture

Quantis is composed of four backend microservices orchestrated via Docker Compose:

1. **API Gateway** (`server/api-gateway`) -- Central REST + WebSocket server. Handles authentication, route management, and real-time data relay via Socket.IO.
2. **Data Collector** (`server/data-collector`) -- Connects to exchange WebSocket feeds (Binance, Bybit, OKX) and persists OHLCV, ticker, and order-book data into TimescaleDB and Redis.
3. **Analysis Engine** (`server/analysis-engine`) -- Computes technical indicators (RSI, MACD, Bollinger Bands, etc.), generates trading signals, and runs the AI copilot inference layer.
4. **Alert Service** (`server/alert-service`) -- Evaluates user-defined alert conditions against live data and dispatches notifications via email, push, Telegram, and webhooks.

A single **React SPA** (`client`) serves as the frontend, communicating with the API Gateway over REST and Socket.IO.

---

## Pages

The platform includes 42+ pages:

| Page               | Route               | Description                              |
| ------------------ | ------------------- | ---------------------------------------- |
| Landing            | `/`                 | Public marketing page                    |
| Dashboard          | `/dashboard`        | Watchlist, portfolio summary, signals    |
| Chart              | `/chart/:symbol?`   | Full-featured interactive chart          |
| Multi-Chart        | `/multi-chart`      | Up to 9 charts side by side             |
| Screener           | `/screener`         | Customizable coin screener               |
| Token Scanner      | `/token-scanner`    | Rug-pull detection and token analysis    |
| Heatmap            | `/heatmap`          | Market heatmap by sector                 |
| Correlation        | `/correlation`      | Correlation matrix                       |
| Seasonality        | `/seasonality`      | Historical seasonality patterns          |
| Exchange Health    | `/exchange-health`  | Exchange proof-of-reserves dashboard     |
| Funding Rates      | `/funding-rates`    | Perp funding rates across exchanges      |
| Narratives         | `/narratives`       | Sector and narrative rotation tracker    |
| Market Breadth     | `/market-breadth`   | Advance/decline and breadth indicators   |
| Open Interest      | `/open-interest`    | Aggregated open interest charts          |
| AI Copilot         | `/copilot`          | Natural-language TA assistant            |
| Signals            | `/signals`          | AI-generated buy/sell signals            |
| Paper Trading      | `/paper-trading`    | Virtual trading simulator                |
| DCA Bot            | `/dca`              | Automated DCA strategy builder           |
| News               | `/news`             | Aggregated crypto news feed              |
| Whale Alert        | `/whale-alert`      | Large transaction monitoring             |
| Academy            | `/academy`          | Educational content and tutorials        |
| Leaderboard        | `/leaderboard`      | Top traders and gamification rankings    |
| Alerts             | `/alerts`           | Custom alert builder                     |
| Journal            | `/journal`          | Trading journal with emotion tracking    |
| Portfolio          | `/portfolio`        | Portfolio tracking and analytics         |
| Copy Trading       | `/copy-trading`     | Follow and copy top traders              |
| Social Feed        | `/social`           | Community posts and discussions          |
| Confluence Map     | `/confluence`       | Multi-indicator confluence overlay       |
| Liquidations       | `/liquidations`     | Liquidation heatmap and tracker          |
| Anti-Liquidation   | `/anti-liquidation` | Position safety calculator               |
| Pattern Scanner    | `/pattern-scanner`  | Automated chart pattern detection        |
| Marketplace        | `/marketplace`      | Indicator and strategy marketplace       |
| Wallet Tracker     | `/wallet-tracker`   | On-chain wallet monitoring               |
| Tax Report         | `/tax-report`       | Tax reporting and CSV export             |
| Profile            | `/profile`          | User profile, XP, and achievements      |
| Chart Replay       | `/chart-replay`     | Historical chart backtesting             |
| Settings           | `/settings`         | App preferences and account settings     |
| Pricing            | `/pricing`          | Subscription plans                       |
| Referral           | `/referral`         | Referral program dashboard               |
| Admin              | `/admin`            | Admin panel (staff only)                 |
| Login              | `/login`            | Authentication                           |
| Register           | `/register`         | Account creation                         |

---

## API

The API Gateway exposes 85+ REST endpoints under `/api/v1/`, organized by domain:

- `/api/v1/auth` -- Registration, login, token refresh
- `/api/v1/market` -- Tickers, OHLCV, order books
- `/api/v1/analysis` -- Indicators, signals, screener
- `/api/v1/alerts` -- CRUD for alert rules
- `/api/v1/watchlist` -- User watchlists
- `/api/v1/paper` -- Paper trading (orders, positions, history)
- `/api/v1/journal` -- Trading journal entries
- `/api/v1/tax` -- Tax report generation, CSV export, summary
- `/api/v1/copilot` -- AI assistant queries
- `/api/v1/news` -- News aggregation
- `/api/v1/whales` -- Whale transaction alerts
- `/api/v1/scanner` -- Token scanner
- `/api/v1/dca` -- DCA bot configuration
- `/api/v1/copy` -- Copy trading
- `/api/v1/social` -- Social feed
- `/api/v1/wallets` -- Wallet tracker
- `/api/v1/marketplace` -- Strategy marketplace
- `/api/v1/gamification` -- XP, achievements, streaks
- `/api/v1/subscription` -- Plans and billing
- `/api/v1/referral` -- Referral tracking
- `/api/v1/admin` -- Admin operations
- `/api/v1/telegram` -- Telegram bot webhook

Real-time data is delivered via Socket.IO channels (`ticker:update`, `signal:new`, `alert:triggered`).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values. Key variables include:

- `DATABASE_URL` -- TimescaleDB connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` -- Redis connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` -- Auth secrets
- `OPENAI_API_KEY` -- For AI Copilot features
- `TELEGRAM_BOT_TOKEN` -- Telegram alert integration
- `SMTP_*` -- Email notification settings

See `.env.example` for the full list.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

Please follow the existing code style and include tests for new features where applicable.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

<!-- Screenshots placeholder: add screenshots here when available -->
<!-- ![Dashboard](./assets/screenshots/dashboard.png) -->
<!-- ![Chart](./assets/screenshots/chart.png) -->
<!-- ![Signals](./assets/screenshots/signals.png) -->
