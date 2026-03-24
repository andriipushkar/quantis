# Testing Guide

## Overview

| Workspace | Framework | Tests | Coverage |
|---|---|---|---|
| shared | Jest + ts-jest | 79 | 100% lines |
| analysis-engine | Jest + ts-jest | 504 | 99.8% lines |
| data-collector | Jest + ts-jest | 52 | 100% lines |
| alert-service | Jest + ts-jest | 61 | 100% lines |
| api-gateway | Jest + ts-jest | ~1,130 | 99.9% lines |
| client | Vitest + jsdom | ~1,500 | 94% lines |
| E2E | Playwright | 36 | — |
| **Total** | | **~3,362** | |

## Running Tests

```bash
# All unit tests (shared + analysis-engine + data-collector + alert-service + client)
npm test

# API gateway tests (includes integration tests)
npm run test:integration

# Individual workspace
npm -w shared run test
npm -w server/analysis-engine run test
npm -w server/data-collector run test
npm -w server/alert-service run test
npm -w server/api-gateway run test
npm -w client run test

# With coverage
npm run test:coverage

# E2E (requires running frontend + backend)
npm run test:e2e

# Watch mode
npx -w server/analysis-engine jest --watch
npx -w client vitest
```

## Test Coverage

Coverage is configured in all workspaces:
- **Jest**: `collectCoverage` in each `jest.config.js` (use `--coverage` flag)
- **Vitest**: `@vitest/coverage-v8` provider in `vitest.config.ts`
- **CI**: GitHub Actions runs with `--coverage` and warns below 80%

```bash
# Generate full coverage report
npm run test:coverage

# View HTML coverage report (after running coverage)
npx serve client/coverage/lcov-report
npx serve server/api-gateway/coverage/lcov-report
```

## Test Structure

### Server Tests (Jest)

```
server/api-gateway/src/__tests__/
├── auth.test.ts              # Auth routes (register, login, JWT, Google OAuth)
├── middleware-auth.test.ts    # JWT authentication & tier gating
├── middleware-csrf.test.ts    # CSRF protection
├── middleware-rateLimiter.test.ts  # Rate limiting per tier
├── middleware-security.test.ts    # Response sanitization, content-type
├── middleware-socketRL.test.ts    # WebSocket rate limiting
├── subscription.test.ts      # Pricing, checkout, webhook, payment history
├── mailer.test.ts            # SMTP email sending
├── wallet-tracker.test.ts    # Wallet tracking CRUD
├── marketplace-routes.test.ts # Strategy marketplace
├── influencers.test.ts       # Influencer data & consensus
├── tokenomics.test.ts        # Token supply & scores
├── emails.test.ts            # Email template rendering
├── docs.test.ts              # OpenAPI spec
├── ohlcv.test.ts             # OHLCV & Renko chart data
├── config.test.ts            # Database, Redis, Logger, Env config
├── utils-*.test.ts           # Email templates, indicators, ticker cache
├── branch-coverage.test.ts   # Branch coverage for edge cases
├── server-100.test.ts        # Final coverage push
└── coverage-100.test.ts      # 100% coverage for socket RL, paper trading
```

### Client Tests (Vitest)

```
client/src/__tests__/
├── components.test.tsx           # Badge, Card, SignalCard
├── components-extended.test.tsx  # Button, Input, Spinner, Toast, ErrorBoundary
├── components-coverage.test.tsx  # Header, Sidebar, Layout, charts
├── components-deep.test.tsx      # GlobalSearch, NotificationCenter, SignalFilters
├── pages-smoke.test.tsx          # All 65 pages render without crash
├── pages-deep.test.tsx           # Deep tests for 11 critical pages
├── pages-deep-batch{1,2,3}.test.tsx  # Deep tests by page groups
├── pages-handlers-{af,gp,qz}.test.tsx  # Event handler tests
├── pages-branch-coverage.test.tsx # Branch coverage for 20+ pages
├── coverage-{95,final}.test.tsx  # Final coverage push tests
├── final-coverage-{1,2}.test.tsx # Additional coverage tests
├── stores.test.ts                # Zustand stores (market, auth, toast)
├── stores-coverage.test.ts       # Theme + notification stores
├── auth-store-deep.test.ts       # Auth store all branches
├── api.test.ts                   # API service functions
├── api-coverage.test.ts          # Remaining API functions
├── socket.test.ts                # Socket.IO service
├── services-branch-coverage.test.ts  # API + socket branch coverage
├── hooks.test.ts                 # useWebSocket hook
├── websocket-coverage.test.ts    # Hook branches (batching, signals)
├── utils.test.ts                 # Utility functions
├── throttle.test.ts              # Throttle utility
├── app-coverage.test.tsx         # App.tsx routes + HomeGate
├── i18n.test.ts                  # i18n configuration
└── main.test.tsx                 # Entry point
```

### E2E Tests (Playwright)

```
e2e/tests/
├── landing.spec.ts     # Landing, login, register, pricing, status pages
├── auth.spec.ts        # Registration + login error handling
├── navigation.spec.ts  # Page navigation, 404, links
├── forms.spec.ts       # Form validation on login/register
└── responsive.spec.ts  # Mobile (375px), tablet (768px), desktop (1920px)
```

## Manual Testing Checklist

### Pre-launch verification

- [ ] Register new user → welcome email received
- [ ] Login → redirects to dashboard
- [ ] Dashboard loads with live ticker data
- [ ] Chart page renders candlesticks for BTCUSDT
- [ ] Screener shows 50+ pairs with filters working
- [ ] Create alert → alert appears in list
- [ ] Delete alert → alert removed
- [ ] Language switch (EN/UA/DE/ES) → all text updates
- [ ] Theme toggle (dark/light) → persists on reload
- [ ] Pricing page → Monthly/Yearly toggle shows correct prices
- [ ] Checkout → creates NOWPayments invoice (sandbox)
- [ ] Onboarding wizard after first registration
- [ ] Paper trading → open/close position
- [ ] Mobile bottom nav → "More" menu shows all pages
- [ ] Logo click → navigates to home

### API Health Check

```bash
# Public endpoints
curl http://localhost:3001/api/v1/market/ticker
curl http://localhost:3001/api/v1/market/fear-greed
curl http://localhost:3001/api/v1/market/regime
curl http://localhost:3001/api/v1/market/screener
curl http://localhost:3001/api/v1/news
curl http://localhost:3001/api/v1/influencers
curl http://localhost:3001/api/v1/tokenomics/BTC
curl http://localhost:3001/api/v1/docs

# Authenticated (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/auth/me
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/alerts
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/journal
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/social/feed
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs:
1. **Quality**: TypeScript type checking + ESLint
2. **Tests**: Matrix across all 6 workspaces with coverage
3. **Build**: Client + shared package build check

Coverage threshold: warns when below 80% per workspace.
