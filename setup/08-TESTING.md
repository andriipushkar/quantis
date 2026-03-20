# Testing Guide

## Test Types

| Type | Framework | Count | Location |
|---|---|---|---|
| Unit Tests | Jest + ts-jest | 42 | `server/analysis-engine/src/__tests__/` |
| Client Tests | Vitest + jsdom | 23 | `client/src/__tests__/` |
| API Integration | Jest + fetch | 22 | `server/api-gateway/src/__tests__/` |
| E2E Tests | Playwright | 7 | `e2e/tests/` |
| **Total** | | **94** | |

## Running Tests

```bash
# All automatic tests (unit + client)
npm test

# Analysis engine unit tests only
npm -w server/analysis-engine run test

# Client utility tests only
npm -w client run test

# API integration tests (requires running server)
npm run test:integration

# E2E tests (requires running frontend)
npm run test:e2e

# Watch mode
npx -w server/analysis-engine jest --watch
npx -w client vitest
```

## Unit Tests (42 tests)

Located in `server/analysis-engine/src/__tests__/`:

### calculator.test.ts (21 tests)
- RSI: correct values, boundary cases, trending data
- EMA: period 9 calculation, constant values, insufficient data
- SMA: manual calculation match, period 5, first value
- ATR: positive values, constant range, insufficient data
- MACD: empty for insufficient, correct arrays
- Bollinger Bands: upper > middle > lower
- VWAP: correct length, empty input

### signals.test.ts (21 tests)
- RSI signal detection: BUY for RSI<25, SELL for RSI>75
- Stop-loss: entry - 2*ATR for buy, entry + 2*ATR for sell
- Take-profit: TP1 at 1:1, TP2 at 1:2, TP3 at 1:3 R/R
- Confidence scoring: monotonicity, range bounds

## Client Tests (23 tests)

Located in `client/src/__tests__/utils.test.ts`:
- `cn()` utility: merging, conditionals, Tailwind conflicts
- `formatPrice`: decimals, zero, large numbers
- `formatPercent`: positive/negative sign, rounding
- `formatVolume`: B/M/K suffixes, boundaries

## API Integration Tests (22 tests)

Located in `server/api-gateway/src/__tests__/api.test.ts`:
- Health check
- Auth: register, duplicate, login, wrong password, profile
- Market: pairs, tickers, OHLCV, screener, fear-greed, correlation, regime
- Analysis: indicators, signals, patterns
- Scanner: risk score

**Requires running server at localhost:3001**

## E2E Tests (7 tests)

Located in `e2e/tests/`:
- Landing page loads with title
- Login page accessible
- Register page accessible
- Pricing page shows 4 tiers
- Status page shows services
- Registration flow
- Login error handling

**Requires running frontend at localhost:5173**

## CI/CD

GitHub Actions runs on push to `main` and PRs:
- TypeScript type checking (`tsc --noEmit`)
- Unit tests (analysis-engine)
- Client tests (vitest)

See `.github/workflows/ci.yml`
