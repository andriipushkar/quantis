# Project Structure

```
quantis/
├── client/                          # React Frontend
│   ├── public/                      # Static files
│   │   ├── manifest.json            # PWA manifest
│   │   ├── quantis.svg              # Logo
│   │   ├── robots.txt               # SEO
│   │   └── sitemap.xml              # SEO
│   ├── src/
│   │   ├── __tests__/               # Client unit tests (Vitest)
│   │   │   └── utils.test.ts
│   │   ├── components/
│   │   │   ├── charts/              # Chart components
│   │   │   │   ├── TradingChart.tsx  # TradingView Lightweight Charts
│   │   │   │   ├── RSIChart.tsx      # RSI sub-chart (canvas)
│   │   │   │   └── DrawingToolbar.tsx
│   │   │   ├── common/              # Reusable UI components
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Button.tsx        # CVA variants
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── GlobalSearch.tsx   # Ctrl+K search
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── NotificationCenter.tsx
│   │   │   │   ├── OnboardingWizard.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── ToastContainer.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── SignalCard.tsx
│   │   │   │   └── WatchlistStrip.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx        # Top bar with search, theme, notifications
│   │   │   │   ├── Layout.tsx        # Sidebar + Header + Outlet
│   │   │   │   └── Sidebar.tsx       # Navigation (30+ items)
│   │   │   └── signals/
│   │   │       └── SignalFilters.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts       # Socket.IO live ticker updates
│   │   ├── i18n/
│   │   │   ├── index.ts             # i18next setup
│   │   │   └── locales/
│   │   │       └── en.json          # English translations
│   │   ├── pages/                   # 63 page components
│   │   │   ├── Academy.tsx          # 15-chapter trading course
│   │   │   ├── Admin.tsx            # Admin panel
│   │   │   ├── Alerts.tsx           # 5-step alert builder + chains
│   │   │   ├── AntiLiquidation.tsx  # Position monitoring
│   │   │   ├── APIDocs.tsx          # API documentation
│   │   │   ├── BitcoinModels.tsx    # S2F, Rainbow, Pi Cycle
│   │   │   ├── Chart.tsx            # Main chart + indicators
│   │   │   ├── ChartReplay.tsx      # Historical replay mode
│   │   │   ├── Confluence.tsx       # Cross-signal confluence
│   │   │   ├── Copilot.tsx          # AI chat
│   │   │   ├── CopyTrading.tsx      # Follow lead traders
│   │   │   ├── Correlation.tsx      # NxN correlation matrix
│   │   │   ├── Dashboard.tsx        # Main dashboard (6 widgets)
│   │   │   ├── DCABot.tsx           # Smart DCA
│   │   │   ├── DeFi.tsx             # DeFi TVL tracker
│   │   │   ├── DevActivity.tsx      # GitHub activity
│   │   │   ├── ElliottWave.tsx      # Wave counting
│   │   │   ├── ExchangeHealth.tsx   # Exchange monitoring
│   │   │   ├── FundingRates.tsx     # Perpetual funding
│   │   │   ├── HarmonicPatterns.tsx # XABCD patterns
│   │   │   ├── Heatmap.tsx          # Market treemap
│   │   │   ├── IndicatorLibrary.tsx # 32 indicators catalog
│   │   │   ├── InfluencerTracker.tsx
│   │   │   ├── IntermarketAnalysis.tsx # TradFi correlation
│   │   │   ├── Journal.tsx          # Trading journal
│   │   │   ├── Landing.tsx          # Public landing page
│   │   │   ├── Leaderboard.tsx      # Rankings
│   │   │   ├── Liquidations.tsx     # Liquidation heatmap
│   │   │   ├── Login.tsx
│   │   │   ├── MarketBreadth.tsx    # A/D indicators
│   │   │   ├── Marketplace.tsx      # Strategy marketplace
│   │   │   ├── MarketProfile.tsx    # TPO / Volume Profile
│   │   │   ├── MultiChart.tsx       # 2x2 chart grid
│   │   │   ├── Narratives.tsx       # Sector narratives
│   │   │   ├── NetworkMetrics.tsx   # On-chain metrics
│   │   │   ├── News.tsx             # Crypto news feed
│   │   │   ├── NotFound.tsx         # 404
│   │   │   ├── OpenInterest.tsx
│   │   │   ├── Options.tsx          # Options chain
│   │   │   ├── OrderFlow.tsx        # Footprint charts
│   │   │   ├── PaperTrading.tsx     # Virtual trading
│   │   │   ├── PatternScanner.tsx
│   │   │   ├── Portfolio.tsx        # Portfolio + CSV + rebalance
│   │   │   ├── Pricing.tsx          # 4 tier pricing
│   │   │   ├── Privacy.tsx          # Privacy policy
│   │   │   ├── Profile.tsx          # XP + achievements
│   │   │   ├── Referral.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── RenkoChart.tsx       # Non-time chart
│   │   │   ├── Screener.tsx         # Advanced screener
│   │   │   ├── ScriptEditor.tsx     # Quantis Script IDE
│   │   │   ├── Seasonality.tsx
│   │   │   ├── Settings.tsx         # Profile + 2FA + Telegram
│   │   │   ├── Signals.tsx
│   │   │   ├── SocialFeed.tsx       # Community posts
│   │   │   ├── Status.tsx           # Public status page
│   │   │   ├── TaxReport.tsx
│   │   │   ├── Terms.tsx            # Terms of Service
│   │   │   ├── Tokenomics.tsx
│   │   │   ├── TokenScanner.tsx
│   │   │   ├── WalletTracker.tsx    # Web3 wallets
│   │   │   ├── WhaleAlert.tsx
│   │   │   └── WyckoffPhase.tsx
│   │   ├── services/
│   │   │   ├── api.ts               # Fetch-based API client
│   │   │   └── socket.ts            # Socket.IO client
│   │   ├── stores/                  # Zustand state management
│   │   │   ├── auth.ts
│   │   │   ├── market.ts
│   │   │   ├── notifications.ts
│   │   │   ├── theme.ts
│   │   │   └── toast.ts
│   │   ├── styles/
│   │   │   └── globals.css          # Tailwind + dark/light theme
│   │   ├── utils/
│   │   │   └── cn.ts                # clsx + tailwind-merge
│   │   ├── App.tsx                  # Router (63 routes)
│   │   └── main.tsx                 # Entry point
│   ├── Dockerfile                   # Multi-stage production build
│   ├── index.html
│   ├── tailwind.config.js           # CSS variable theme
│   ├── vite.config.ts
│   └── vitest.config.ts
│
├── server/
│   ├── api-gateway/                 # Express + Socket.IO (port 3001)
│   │   ├── src/
│   │   │   ├── __tests__/           # Integration tests
│   │   │   ├── config/              # DB, Redis, Logger
│   │   │   ├── middleware/           # Auth, Rate limiter
│   │   │   ├── routes/              # 28 route modules (120 endpoints)
│   │   │   │   ├── admin.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   ├── analysis.ts      # Indicators, patterns, signals,
│   │   │   │   │                    # Elliott, harmonics, Wyckoff
│   │   │   │   ├── auth.ts          # Register, login, 2FA
│   │   │   │   ├── copilot.ts       # AI chat
│   │   │   │   ├── copy-trading.ts
│   │   │   │   ├── dca.ts
│   │   │   │   ├── docs.ts          # OpenAPI spec + Swagger UI
│   │   │   │   ├── emails.ts
│   │   │   │   ├── exchange-health.ts
│   │   │   │   ├── gamification.ts
│   │   │   │   ├── influencers.ts
│   │   │   │   ├── journal.ts
│   │   │   │   ├── leaderboard.ts
│   │   │   │   ├── market.ts        # Pairs, OHLCV, tickers, screener,
│   │   │   │   │                    # Fear&Greed, regime, breadth, etc.
│   │   │   │   ├── marketplace.ts
│   │   │   │   ├── news.ts
│   │   │   │   ├── paper-trading.ts
│   │   │   │   ├── referral.ts
│   │   │   │   ├── social.ts
│   │   │   │   ├── subscription.ts
│   │   │   │   ├── tax.ts
│   │   │   │   ├── telegram.ts
│   │   │   │   ├── token-scanner.ts
│   │   │   │   ├── tokenomics.ts
│   │   │   │   ├── wallet-tracker.ts
│   │   │   │   ├── watchlist.ts
│   │   │   │   └── whales.ts
│   │   │   ├── utils/
│   │   │   │   └── email-templates.ts
│   │   │   ├── validators/
│   │   │   │   └── auth.ts          # Zod schemas
│   │   │   └── index.ts             # Server entry
│   │   └── Dockerfile
│   │
│   ├── data-collector/              # Exchange WebSocket (port 3002)
│   │   └── src/
│   │       ├── collectors/
│   │       │   ├── base.ts          # Abstract base
│   │       │   ├── binance.ts       # 10 pairs + backfill
│   │       │   ├── bybit.ts         # 5 pairs + backfill
│   │       │   └── okx.ts           # 5 pairs + backfill
│   │       └── normalizers/
│   │           └── index.ts
│   │
│   ├── analysis-engine/             # Indicator engine (port 3003)
│   │   └── src/
│   │       ├── __tests__/           # 42 unit tests
│   │       ├── indicators/
│   │       ├── patterns/
│   │       └── signals/
│   │
│   └── alert-service/               # Alert delivery (port 3004)
│       └── src/
│           ├── evaluators/
│           └── delivery/
│
├── shared/                          # Shared types + constants
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # 19 tables
│   └── migrate.js
│
├── docker/
│   └── nginx/
│       ├── nginx.conf               # Development reverse proxy
│       ├── nginx-ssl.conf           # Production with SSL
│       └── client.conf              # SPA routing
│
├── e2e/                             # Playwright E2E tests
│   ├── playwright.config.ts
│   └── tests/
│       ├── landing.spec.ts
│       └── auth.spec.ts
│
├── scripts/
│   ├── deploy.sh                    # Production deploy
│   └── backup.sh                    # Database backup
│
├── setup/                           # ← You are here
├── docker-compose.yml               # Development
├── docker-compose.prod.yml          # Production override
├── .env.example
├── .github/workflows/ci.yml         # GitHub Actions CI
├── CHANGELOG.md
├── CLAUDE.md
├── LICENSE
├── README.md
└── package.json                     # Monorepo workspaces
```
