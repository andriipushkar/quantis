# 09 — Тестування Admin, System, Public pages

---

## Тест 9.1: Admin Panel (потребує admin email)

**Передумова:** Додати свій email в `ADMIN_EMAILS` в `.env`:
```
ADMIN_EMAILS=test@quantis.io
```
Перезапустити API.

**Кроки:**
1. Залогінитись як test@quantis.io
2. Перейти на http://localhost:5173/admin

**Очікуваний результат:**
- Stats Cards: Total Users, Users Today, Total Signals, Total Candles, Active Pairs, Revenue
- Users Table: email, tier, created date
- System Health: DB status, Redis status, candles per exchange

**Кроки:**
3. В Users Table змінити tier юзера на "trader" через dropdown

**Очікуваний результат:**
- Tier оновлюється

---

## Тест 9.2: Status Page (public)

**Кроки:**
1. Відкрити http://localhost:5173/status (без логіну)

**Очікуваний результат:**
- Overall Status: "All Systems Operational" (зелений) або "Partial Outage"
- Services: API Gateway, Data Collector, Analysis Engine, Alert Service — кожен зі status dot
- Exchanges: Binance, Bybit, OKX — health scores
- Database status, API uptime
- "Last checked" timestamp
- Auto-refresh 30с

---

## Тест 9.3: Landing Page (public)

**Кроки:**
1. Вийти з акаунту (або відкрити incognito)
2. Перейти на http://localhost:5173/

**Очікуваний результат:**
- Hero: "All-in-One Crypto Analysis Platform"
- Live BTC Price badge (оновлюється)
- 2 кнопки: "Get Started Free" → /register, "View Demo" → /chart/BTCUSDT
- 6 Feature cards (Charts, Signals, Screener, Derivatives, AI Copilot, Portfolio)
- 4 Pricing cards (Starter Free, Trader $29, Pro $79, Institutional $249)
- Footer: Terms, Privacy, Status, © 2026 Quantis

---

## Тест 9.4: Pricing Page (public)

**Кроки:**
1. Перейти на http://localhost:5173/pricing

**Очікуваний результат:**
- 4 тарифні картки
- Pro виділена золотою рамкою + "Most Popular"
- Monthly/Annual toggle (Annual = 20% discount)
- Feature lists з ✓ іконками
- "Pay with USDT, BTC, ETH, SOL" text
- FAQ accordion (5 питань)

---

## Тест 9.5: Terms of Service (public)

**Кроки:**
1. Перейти на http://localhost:5173/terms

**Очікуваний результат:**
- 11 секцій Terms of Service
- Чистий текст, readable typography
- Sections: Service Description, Eligibility, Account, Prohibited Use, IP, Liability, Subscriptions...

---

## Тест 9.6: Privacy Policy (public)

**Кроки:**
1. Перейти на http://localhost:5173/privacy

**Очікуваний результат:**
- 8 секцій Privacy Policy
- Data collected, NOT collected, storage, no sharing, retention, GDPR/CCPA, cookies

---

## Тест 9.7: API Documentation (public)

**Кроки:**
1. Перейти на http://localhost:5173/api-docs

**Очікуваний результат:**
- Endpoint list по категоріях
- Method badges: GET (зелений), POST (синій), PUT (жовтий), DELETE (червоний)
- Code examples (curl + JavaScript)
- Rate limiting table per tier
- Link to Swagger UI

**Кроки:**
2. Відкрити http://localhost:3001/api/v1/docs/ui

**Очікуваний результат:**
- Swagger UI з темною темою
- 30+ endpoints документовані
- Можна "Try it out" для кожного endpoint

---

## Тест 9.8: 404 Page

**Кроки:**
1. Перейти на http://localhost:5173/nonexistent-page

**Очікуваний результат:**
- Велике "404"
- "Page not found"
- Кнопки: "Go to Dashboard", "Go Home"

---

## Тест 9.9: Settings — Telegram

**Кроки:**
1. Залогінитись
2. На Settings знайти секцію "Telegram"
3. Ввести Chat ID: `123456789`
4. Натиснути "Connect"

**Очікуваний результат:**
- Status змінюється на "Connected"
- Кнопки "Send Test" та "Disconnect"

---

## Тест 9.10: Settings — Theme

**Кроки:**
1. На Settings знайти секцію "Appearance"
2. Вибрати "Light"

**Очікуваний результат:**
- Вся сторінка переключається на light theme
- Radio button "Light" виділений

**Кроки:**
3. Вибрати "Dark"

**Очікуваний результат:**
- Повернення до dark theme

---

## Тест 9.11: Health Check API

```bash
# Всі сервіси
for port in 3001 3002 3003 3004; do
  echo "Port $port:"
  curl -s http://localhost:$port/health | python3 -m json.tool
  echo ""
done
```

**Очікуваний результат:**
- Кожен повертає `"status": "ok"` або `"status": "healthy"`
- uptime > 0
- connections: database connected, redis ready

---

## Тест 9.12: OpenAPI Spec

```bash
curl -s http://localhost:3001/api/v1/docs | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(f'OpenAPI version: {d[\"openapi\"]}')
print(f'Title: {d[\"info\"][\"title\"]}')
print(f'Paths: {len(d[\"paths\"])}')
for path in sorted(d['paths'].keys())[:10]:
    methods = list(d['paths'][path].keys())
    print(f'  {methods[0].upper():6} {path}')
print('  ...')
"
```

**Очікуваний результат:**
- OpenAPI 3.1.0
- 30+ paths documented
