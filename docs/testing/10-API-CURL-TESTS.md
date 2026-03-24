# 10 — Повне API тестування через curl

Виконувати послідовно. Кожна команда має повернути JSON з `"success":true`.

---

## Підготовка

```bash
# Перевірити що API працює
curl -s http://localhost:3001/health
# → {"status":"ok","uptime":...}
```

## Auth

```bash
# Реєстрація
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"curltest@test.com","password":"TestPass1234"}'
# → {"success":true,"data":{"user":{"id":"...","email":"curltest@test.com","tier":"starter"},"accessToken":"...","refreshToken":"..."}}

# Зберегти токен
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"curltest@test.com","password":"TestPass1234"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')
echo "Token: ${TOKEN:0:20}..."

# Профіль
curl -s http://localhost:3001/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
# → {"success":true,"data":{"id":"...","email":"curltest@test.com","tier":"starter"}}

# 2FA setup
curl -s -X POST http://localhost:3001/api/v1/auth/2fa/setup -H "Authorization: Bearer $TOKEN"
# → {"success":true,"data":{"secret":"...","qrCodeUrl":"otpauth://..."}}
```

## Market Data

```bash
# Пари
curl -s http://localhost:3001/api/v1/market/pairs
# → 20 pairs

# Тікери
curl -s http://localhost:3001/api/v1/market/ticker
# → tickers object

# Один тікер
curl -s http://localhost:3001/api/v1/market/ticker/BTCUSDT
# → BTC price

# OHLCV
curl -s "http://localhost:3001/api/v1/market/ohlcv/BTCUSDT?timeframe=1m&limit=10"
# → 10 candles

# Screener
curl -s http://localhost:3001/api/v1/market/screener
# → 20 items with RSI + trend

# Fear & Greed
curl -s http://localhost:3001/api/v1/market/fear-greed
# → score 0-100, label

# Correlation
curl -s http://localhost:3001/api/v1/market/correlation
# → 20x20 matrix

# Regime
curl -s http://localhost:3001/api/v1/market/regime
# → regime name, confidence, recommended strategies

# Breadth
curl -s http://localhost:3001/api/v1/market/breadth
# → score, advancing, declining

# Narratives
curl -s http://localhost:3001/api/v1/market/narratives
# → 6 sectors

# Seasonality
curl -s http://localhost:3001/api/v1/market/seasonality/BTCUSDT
# → 24 hourly + 7 daily

# Open Interest
curl -s http://localhost:3001/api/v1/market/open-interest
# → OI per pair

# Funding Rates
curl -s http://localhost:3001/api/v1/market/funding-rates
# → 20 rates

# Liquidations
curl -s http://localhost:3001/api/v1/market/liquidations/BTCUSDT
# → 20 levels

# Confluence
curl -s http://localhost:3001/api/v1/market/confluence/BTCUSDT
# → zones

# Order Flow
curl -s http://localhost:3001/api/v1/market/orderflow/BTCUSDT
# → footprint data

# Market Profile
curl -s http://localhost:3001/api/v1/market/profile/BTCUSDT
# → POC, VA, volume distribution

# Renko
curl -s http://localhost:3001/api/v1/market/renko/BTCUSDT
# → bricks

# Options
curl -s http://localhost:3001/api/v1/market/options/BTCUSDT
# → chain, maxPain, P/C ratio

# Multi-Asset
curl -s http://localhost:3001/api/v1/market/multi-asset
# → 10 assets, correlations

# DeFi
curl -s http://localhost:3001/api/v1/market/defi
# → 10 protocols, TVL

# Dev Activity
curl -s http://localhost:3001/api/v1/market/dev-activity
# → 5 projects

# Network Metrics
curl -s http://localhost:3001/api/v1/market/network-metrics/BTCUSDT
# → DAA, NVT, health

# BTC Models
curl -s http://localhost:3001/api/v1/market/btc-models
# → 5 models, consensus
```

## Analysis

```bash
# Indicators
curl -s http://localhost:3001/api/v1/analysis/indicators/BTCUSDT
# → RSI, EMA9, EMA21, SMA20, BB

# Signals
curl -s http://localhost:3001/api/v1/analysis/signals
# → signal list

# Patterns
curl -s http://localhost:3001/api/v1/analysis/patterns/BTCUSDT
# → detected patterns

# Elliott Wave
curl -s http://localhost:3001/api/v1/analysis/elliott/BTCUSDT
# → wave count

# Harmonics
curl -s http://localhost:3001/api/v1/analysis/harmonics/BTCUSDT
# → XABCD patterns

# Wyckoff
curl -s http://localhost:3001/api/v1/analysis/wyckoff/BTCUSDT
# → phase, events
```

## Authenticated Features

```bash
# Paper Trading
curl -s http://localhost:3001/api/v1/paper/account -H "Authorization: Bearer $TOKEN"
# → balance $10,000

curl -s -X POST http://localhost:3001/api/v1/paper/order \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"symbol":"BTCUSDT","side":"buy","quantity":1000}'
# → order confirmation

curl -s http://localhost:3001/api/v1/paper/positions -H "Authorization: Bearer $TOKEN"
# → open positions

# Journal
curl -s -X POST http://localhost:3001/api/v1/journal \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"pair":"BTCUSDT","direction":"long","entryPrice":69000,"exitPrice":71000,"size":1000,"strategy":"trend_following","emotional_state":"calm","confidence":4}'
# → trade with P&L

curl -s http://localhost:3001/api/v1/journal/stats -H "Authorization: Bearer $TOKEN"
# → win rate, profit factor

# Alerts
curl -s -X POST http://localhost:3001/api/v1/alerts \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"BTC above 75k","conditions":{"type":"price_above","symbol":"BTCUSDT","value":75000},"channels":["push"]}'
# → alert created

curl -s http://localhost:3001/api/v1/alerts -H "Authorization: Bearer $TOKEN"
# → alert list

# Copilot
curl -s -X POST http://localhost:3001/api/v1/copilot/ask \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Analyze BTC","symbol":"BTCUSDT"}'
# → AI analysis with context

# Gamification
curl -s -X POST http://localhost:3001/api/v1/gamification/award \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"view_chart"}'
# → XP awarded

curl -s http://localhost:3001/api/v1/gamification/profile -H "Authorization: Bearer $TOKEN"
# → level, XP, achievements

# Referral
curl -s http://localhost:3001/api/v1/referral -H "Authorization: Bearer $TOKEN"
# → referral code, stats

# Watchlist
curl -s -X POST http://localhost:3001/api/v1/watchlist/ETHUSDT -H "Authorization: Bearer $TOKEN"
# → added

curl -s http://localhost:3001/api/v1/watchlist -H "Authorization: Bearer $TOKEN"
# → watchlist items

curl -s -X DELETE http://localhost:3001/api/v1/watchlist/ETHUSDT -H "Authorization: Bearer $TOKEN"
# → removed
```

## Public Content

```bash
# News
curl -s http://localhost:3001/api/v1/news
# → 12 articles

# Whales
curl -s http://localhost:3001/api/v1/whales
# → whale alerts

# Social Feed
curl -s http://localhost:3001/api/v1/social/feed
# → 10 posts

# Copy Trading Leaders
curl -s http://localhost:3001/api/v1/copy/leaders
# → 8 leaders

# Marketplace
curl -s http://localhost:3001/api/v1/marketplace
# → 8 strategies

# Leaderboard
curl -s http://localhost:3001/api/v1/leaderboard/paper
# → 10 traders

# Influencers
curl -s http://localhost:3001/api/v1/influencers
# → 10 influencers

# Tokenomics
curl -s http://localhost:3001/api/v1/tokenomics/BTC
# → score 95

# Token Scanner
curl -s http://localhost:3001/api/v1/scanner/BTCUSDT
# → 87/100 SAFE

# Exchange Health
curl -s http://localhost:3001/api/v1/exchanges/health
# → 3 exchanges

# Pricing
curl -s http://localhost:3001/api/v1/subscription/pricing
# → 4 tiers

# OpenAPI Spec
curl -s http://localhost:3001/api/v1/docs | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OpenAPI {d[\"openapi\"]}: {len(d[\"paths\"])} paths')"
# → OpenAPI 3.1.0: 38 paths
```

---

## Автоматична перевірка всіх endpoints

```bash
#!/bin/bash
# Зберегти як test/run-all-api-tests.sh та зробити chmod +x

TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@quantis.io","password":"TestPass1234"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')

pass=0; fail=0

check() {
  local name="$1" url="$2" auth="$3"
  headers="-H 'Content-Type: application/json'"
  [ "$auth" = "auth" ] && headers="$headers -H 'Authorization: Bearer $TOKEN'"

  status=$(eval "curl -s -o /dev/null -w '%{http_code}' $headers '$url'")
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "  ✅ $name ($status)"
    ((pass++))
  else
    echo "  ❌ $name ($status)"
    ((fail++))
  fi
}

echo "Testing all API endpoints..."
check "Health" "http://localhost:3001/health"
check "Pairs" "http://localhost:3001/api/v1/market/pairs"
check "Tickers" "http://localhost:3001/api/v1/market/ticker"
check "OHLCV" "http://localhost:3001/api/v1/market/ohlcv/BTCUSDT?timeframe=1m"
check "Screener" "http://localhost:3001/api/v1/market/screener"
check "Fear&Greed" "http://localhost:3001/api/v1/market/fear-greed"
check "Regime" "http://localhost:3001/api/v1/market/regime"
check "Breadth" "http://localhost:3001/api/v1/market/breadth"
check "Correlation" "http://localhost:3001/api/v1/market/correlation"
check "Narratives" "http://localhost:3001/api/v1/market/narratives"
check "Seasonality" "http://localhost:3001/api/v1/market/seasonality/BTCUSDT"
check "OI" "http://localhost:3001/api/v1/market/open-interest"
check "Funding" "http://localhost:3001/api/v1/market/funding-rates"
check "Liquidations" "http://localhost:3001/api/v1/market/liquidations/BTCUSDT"
check "Confluence" "http://localhost:3001/api/v1/market/confluence/BTCUSDT"
check "OrderFlow" "http://localhost:3001/api/v1/market/orderflow/BTCUSDT"
check "Profile" "http://localhost:3001/api/v1/market/profile/BTCUSDT"
check "Renko" "http://localhost:3001/api/v1/market/renko/BTCUSDT"
check "Options" "http://localhost:3001/api/v1/market/options/BTCUSDT"
check "MultiAsset" "http://localhost:3001/api/v1/market/multi-asset"
check "DeFi" "http://localhost:3001/api/v1/market/defi"
check "DevActivity" "http://localhost:3001/api/v1/market/dev-activity"
check "Network" "http://localhost:3001/api/v1/market/network-metrics/BTCUSDT"
check "BTCModels" "http://localhost:3001/api/v1/market/btc-models"
check "Indicators" "http://localhost:3001/api/v1/analysis/indicators/BTCUSDT"
check "Signals" "http://localhost:3001/api/v1/analysis/signals"
check "Patterns" "http://localhost:3001/api/v1/analysis/patterns/BTCUSDT"
check "Elliott" "http://localhost:3001/api/v1/analysis/elliott/BTCUSDT"
check "Harmonics" "http://localhost:3001/api/v1/analysis/harmonics/BTCUSDT"
check "Wyckoff" "http://localhost:3001/api/v1/analysis/wyckoff/BTCUSDT"
check "Scanner" "http://localhost:3001/api/v1/scanner/BTCUSDT"
check "News" "http://localhost:3001/api/v1/news"
check "Whales" "http://localhost:3001/api/v1/whales"
check "Social" "http://localhost:3001/api/v1/social/feed"
check "Leaders" "http://localhost:3001/api/v1/copy/leaders"
check "Marketplace" "http://localhost:3001/api/v1/marketplace"
check "Leaderboard" "http://localhost:3001/api/v1/leaderboard/paper"
check "Influencers" "http://localhost:3001/api/v1/influencers"
check "Tokenomics" "http://localhost:3001/api/v1/tokenomics/BTC"
check "ExHealth" "http://localhost:3001/api/v1/exchanges/health"
check "Pricing" "http://localhost:3001/api/v1/subscription/pricing"
check "Docs" "http://localhost:3001/api/v1/docs"

echo ""
echo "Results: $pass passed, $fail failed out of $((pass+fail))"
```
