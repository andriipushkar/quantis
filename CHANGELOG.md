# Changelog

All notable changes to the Quantis platform are documented in this file.

## [v0.8.0] — 2026-03-20

### Added
- Unit tests for analysis engine (RSI, EMA, SMA, ATR, MACD, Bollinger Bands, VWAP)
- Integration tests for API Gateway (health, market, auth)
- Production Dockerfiles with multi-stage builds (client + api-gateway)
- Nginx production config with SPA routing and asset caching
- GitHub Actions CI/CD pipeline (lint, typecheck, test)
- MIT License
- This changelog

## [v0.7.0] — Indicator Library, Global Search, Notification Center

### Added
- Indicator library with browsable technical indicators
- Global search across assets, pages, and settings
- Notification center with real-time push updates

## [v0.6.0] — Drawing Tools, Options Analytics, Status Page

### Added
- Chart drawing tools (trendlines, channels, Fibonacci)
- Options analytics dashboard
- Platform status page with service health monitoring

## [v0.5.0] — Tax Reporting, Nginx, Documentation

### Added
- Tax reporting module with CSV/PDF export
- Nginx reverse proxy configuration for production
- Comprehensive README documentation

## [v0.4.0] — Strategy Marketplace, Wallet Tracker, Emails

### Added
- Strategy marketplace for sharing and discovering trading strategies
- Wallet tracker with on-chain balance monitoring
- Email template system (welcome, alerts, reports)

## [v0.3.1] — Liquidation Heatmap, Anti-Liquidation Shield, Pattern Scanner

### Added
- Liquidation heatmap visualization
- Anti-liquidation shield with margin alerts
- Candlestick and chart pattern scanner

## [v0.3.0] — Admin Panel, 2FA, Telegram Bot

### Added
- Admin panel with user management and analytics
- Two-factor authentication (TOTP)
- Telegram bot for alerts and portfolio summaries

## [v0.2.5] — Copy Trading, Social Feed, Confluence Map

### Added
- Copy trading system with leader/follower mechanics
- Social feed with posts, likes, and comments
- Signal confluence map overlay

## [v0.2.4] — Onboarding Wizard, XP Gamification, Chart Replay

### Added
- Onboarding wizard for new users
- XP-based gamification system with achievements
- Chart replay mode for historical review

## [v0.2.3] — Narrative Tracker, Market Breadth, Open Interest

### Added
- Crypto narrative tracker (DeFi, AI, L2, etc.)
- Market breadth indicators
- Open interest charts and analysis

## [v0.2.2] — Market Regime, Exchange Health, Funding Rates

### Added
- Market regime detector (trending, ranging, volatile)
- Exchange health monitor with uptime tracking
- Funding rate charts for perpetual futures

## [v0.2.1] — Token Risk Scanner, Smart DCA Bot, Seasonality

### Added
- Token risk scanner with contract and liquidity analysis
- Smart DCA bot with automated scheduling
- Seasonality analytics (day-of-week, monthly patterns)

## [v0.2.0] — Trading Journal, Multi-Chart, Watchlist, CSV Export

### Added
- Trading journal with entry/exit logging and notes
- Multi-chart layout with customizable grid
- Enhanced watchlist management
- CSV export for portfolio and trade data

## [v0.1.5] — Correlation Matrix, Alert Builder, Leaderboard

### Added
- Asset correlation matrix heatmap
- Visual alert builder with conditions
- Community leaderboard

## [v0.1.4] — Referral System, Pricing Page, Subscriptions

### Added
- Referral system with tracking codes and rewards
- Pricing page with tiered plans
- Subscription API with Stripe integration

## [v0.1.3] — News Feed, Whale Alerts, PWA, Error Boundary

### Added
- Aggregated crypto news feed
- Whale alert tracker (large transactions)
- Progressive Web App (PWA) support
- React error boundary for graceful failures

## [v0.1.2] — Trading Academy, OKX Exchange, Signal Badges

### Added
- Trading academy with lessons and quizzes
- OKX exchange integration
- Custom 404 page
- Signal confidence badges

## [v0.1.1] — AI Copilot, Paper Trading

### Added
- AI copilot chat for market analysis assistance
- Paper trading simulator with virtual portfolio

## [v0.1.0] — Initial Platform

### Added
- Full-stack crypto analytics platform (React + Express + PostgreSQL + Redis)
- Real-time ticker data via WebSocket
- TradingView-style candlestick charts with indicators overlay
- Historical OHLCV backfill system
- Binance and Bybit exchange connectors
- Advanced screener with RSI and trend filters
- Fear & Greed index widget
- Market heatmap
- RSI sub-chart
- Portfolio tracker
- Landing page, settings page, toast notifications
- JWT authentication with secure cookies
- Rate limiting, CORS, Helmet security middleware
