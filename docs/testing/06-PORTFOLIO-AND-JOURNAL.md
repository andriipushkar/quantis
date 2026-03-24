# 06 — Тестування Portfolio, Journal, Tax

---

## Тест 6.1: Portfolio — demo режим

**Кроки:**
1. Перейти на http://localhost:5173/portfolio

**Очікуваний результат:**
- Portfolio Summary: Total Value, 24H Change
- "Demo Mode" badge
- Donut pie chart з алокацією (BTC, ETH, SOL, BNB)
- Positions Table: Asset, Holdings, Price, Market Value, 24H%, Allocation %
- Ціни оновлюються в реальному часі

---

## Тест 6.2: Portfolio — CSV Export

**Кроки:**
1. На сторінці Portfolio натиснути "Export CSV"

**Очікуваний результат:**
- Завантажується файл .csv
- Відкрити в Excel/Numbers: стовпці Asset, Holdings, Entry Price, Current Price, Market Value, 24H Change %, Allocation %

---

## Тест 6.3: Portfolio — Rebalancing

**Кроки:**
1. Прокрутити до секції "Portfolio Rebalance"
2. Встановити targets: BTC 50%, ETH 30%, SOL 15%, BNB 5%
3. Перевірити що сума = 100%

**Очікуваний результат:**
- Current vs Target порівняння (бари)
- Suggestions: "Sell $X of BTC" / "Buy $X of ETH" щоб досягти targets
- Кнопка "Auto-Rebalance" → toast "Coming soon"

---

## Тест 6.4: Trading Journal — додавання трейду

**Кроки:**
1. Перейти на http://localhost:5173/journal
2. Натиснути "Add Trade"
3. Заповнити форму:
   - Pair: BTCUSDT
   - Direction: Long
   - Entry Price: 68000
   - Exit Price: 71000
   - Size: $1000
   - Strategy: Trend Following
   - Emotional State: Calm
   - Confidence: 4 зірки (клікнути 4-ту)
   - Notes: "EMA crossover confirmed"
4. Натиснути "Save"

**Очікуваний результат:**
- Трейд з'являється в таблиці
- P&L розрахований: +$44.12 (+4.41%)
- Рядок зелений (profitable)

---

## Тест 6.5: Trading Journal — stats

**Кроки:**
1. Додати ще один трейд:
   - ETHUSDT, Short, Entry 2200, Exit 2300, Size $500
   - Strategy: Mean Reversion, Emotion: FOMO, Confidence: 2

**Очікуваний результат:**
- Stats Bar оновлюється:
  - Total Trades: 2
  - Win Rate: 50%
  - Avg Win: ~$44
  - Avg Loss: ~-$23
  - Profit Factor: ~1.9

---

## Тест 6.6: Trading Journal — видалення

**Кроки:**
1. Натиснути іконку видалення біля збиткового трейду

**Очікуваний результат:**
- Трейд зникає
- Stats оновлюються (Win Rate 100%)

---

## Тест 6.7: Tax Report

**Кроки:**
1. Перейти на http://localhost:5173/tax-report

**Очікуваний результат:**
- Summary Cards: Total Gains (зелений), Total Losses (червоний), Net P&L, Total Trades
- By Asset таблиця: symbol, total P&L, trade count
- Trade History таблиця з усіма деталями
- Tax Method: FIFO (активний), LIFO/HIFO disabled
- Year selector: 2026
- Disclaimer внизу

---

## Тест 6.8: Tax Report — CSV export

**Кроки:**
1. Натиснути "Download CSV"

**Очікуваний результат:**
- Завантажується CSV з стовпцями: Date, Pair, Direction, Entry, Exit, P&L, %, Holding Period

---

## Тест 6.9: Wallet Tracker

**Кроки:**
1. Перейти на http://localhost:5173/wallet-tracker
2. В "Add Wallet":
   - Address: `0x1234567890abcdef1234567890abcdef12345678`
   - Chain: Ethereum
   - Label: "My Hot Wallet"
3. Натиснути "Track"

**Очікуваний результат:**
- Wallet з'являється в списку
- Truncated address, "Ethereum" badge, label
- Total Value (mock)

**Кроки:**
4. Клікнути на wallet

**Очікуваний результат:**
- Розкривається: таблиця holdings (3-5 токенів: ETH, USDT, UNI...)
- Кожен: token, amount, value, 24h change

**Кроки:**
5. Натиснути "Remove"

**Очікуваний результат:**
- Wallet зникає зі списку
