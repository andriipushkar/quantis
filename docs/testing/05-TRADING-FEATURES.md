# 05 — Тестування торгових функцій

---

## Тест 5.1: Сигнали

**Кроки:**
1. Перейти на http://localhost:5173/signals

**Очікуваний результат:**
- Список сигналів (або "Analysis Engine Running" якщо ще немає)
- Кожен сигнал: BUY/SELL badge, пара, стратегія, strength, confidence bar
- Entry, SL, TP1, TP2 з відсотками від entry
- Reasoning текст
- Кнопка "Open Chart →"
- Кнопка refresh (RefreshCw icon)

**API перевірка:**
```bash
curl http://localhost:3001/api/v1/analysis/signals
```

---

## Тест 5.2: Paper Trading — створення акаунту

**Кроки:**
1. Залогінитись
2. Перейти на http://localhost:5173/paper-trading

**Очікуваний результат:**
- Account Summary: Balance $10,000.00, Equity $10,000.00
- Unrealized P&L: $0.00, Realized P&L: $0.00
- Quick Trade Panel з dropdown пари та кнопками Buy/Sell

---

## Тест 5.3: Paper Trading — купівля

**Кроки:**
1. В Quick Trade Panel вибрати пару: BTCUSDT
2. Ввести amount: 1000
3. Натиснути "Buy"

**Очікуваний результат:**
- В Open Positions з'являється рядок:
  - BTCUSDT, buy, кількість BTC (≈0.014), entry price
  - P&L оновлюється в реальному часі
- Balance зменшився на $1,000 (стало $9,000)
- Equity = Balance + Unrealized P&L

---

## Тест 5.4: Paper Trading — закриття позиції

**Кроки:**
1. Натиснути "Close" біля BTCUSDT позиції

**Очікуваний результат:**
- Позиція зникає з Open Positions
- P&L додається до Realized P&L
- Balance повертається + P&L
- Запис з'являється в Trade History

---

## Тест 5.5: Paper Trading — продаж (short)

**Кроки:**
1. Вибрати ETHUSDT, ввести 500, натиснути "Sell"

**Очікуваний результат:**
- Позиція: ETHUSDT, sell, entry price
- P&L позитивний якщо ціна падає, негативний якщо зростає

---

## Тест 5.6: DCA Bot — створення бота

**Кроки:**
1. Перейти на http://localhost:5173/dca
2. В формі Create Bot:
   - Symbol: BTCUSDT
   - Amount: $100
   - Interval: Weekly
   - Strategy: RSI Weighted
3. Натиснути "Create Bot"

**Очікуваний результат:**
- Бот з'являється в списку Active Bots
- Показує: symbol, strategy, amount, interval

**Кроки:**
4. Натиснути "Simulate" біля бота

**Очікуваний результат:**
- Simulation Card з графіком (invested vs value)
- Stats: Total Invested, Current Value, ROI%, Avg Buy Price

---

## Тест 5.7: Copy Trading

**Кроки:**
1. Перейти на http://localhost:5173/copy-trading

**Очікуваний результат:**
- 8 Lead Trader карточок
- Кожен: ім'я, badge (bronze/silver/gold/platinum), Win Rate, Return, Drawdown, Copiers
- Risk Score bar (1-5)
- "Copy" кнопка

**Кроки:**
2. Натиснути "Copy" на будь-якому трейдері
3. Ввести allocation: 500
4. Підтвердити

**Очікуваний результат:**
- З'являється в "My Active Copies"
- Кнопка змінюється на "Stop Copy"

---

## Тест 5.8: Alerts — 5-step builder

**Кроки:**
1. Перейти на http://localhost:5173/alerts
2. Натиснути "Create Alert"

**Крок 1: Select Pair**
3. Вибрати BTCUSDT з dropdown → Next

**Крок 2: Condition**
4. Вибрати "Price Above" → Next

**Крок 3: Value**
5. Ввести 75000 (показує поточну ціну BTC) → Next

**Крок 4: Channels**
6. Checkbox "In-app Push" вибраний → Next

**Крок 5: Name**
7. Автоматично: "BTC above $75,000"
8. Натиснути "Create Alert"

**Очікуваний результат:**
- Алерт з'являється в списку зі статусом Active (зелена крапка)
- Кнопка видалення (корзина)

---

## Тест 5.9: Alert Chains (Pro feature)

**Кроки:**
1. На сторінці Alerts прокрутити до секції "Alert Chains"

**Очікуваний результат:**
- 3 шаблони: Macro Crash Detector, Whale + TA Confluence, Funding Rate Arbitrage
- Кожен показує IF-THEN-AND логіку візуально
- "PRO" badge
- "Activate" → toast "Pro feature"

---

## Тест 5.10: Liquidation Heatmap

**Кроки:**
1. Перейти на http://localhost:5173/liquidations
2. Вибрати BTCUSDT

**Очікуваний результат:**
- Горизонтальний bar chart (canvas):
  - Центр = поточна ціна
  - Ліво (червоні) = long liquidations
  - Право (зелені) = short liquidations
- Summary: Total Long, Total Short, Nearest Cluster
- Cascade Warning якщо великий кластер < 2% від ціни

---

## Тест 5.11: Anti-Liquidation Shield

**Кроки:**
1. Створити paper trading позицію (Тест 5.3)
2. Перейти на http://localhost:5173/anti-liquidation

**Очікуваний результат:**
- Position Cards з gauge (зелений > 20%, жовтий 10-20%, червоний < 5%)
- Entry, Current, Liquidation prices
- What-If Simulator (slider)

**Кроки:**
3. Потягнути slider вниз на -20%

**Очікуваний результат:**
- Показує які позиції будуть ліквідовані
- Рекомендації: "Reduce position by X%"

---

## Тест 5.12: Funding Rates

**Кроки:**
1. Перейти на http://localhost:5173/funding-rates

**Очікуваний результат:**
- Таблиця: Symbol, Exchange, Rate (зелений negative / червоний positive), Annualized %, Next Funding (countdown), Prediction
- Summary: avg rate, most extreme pair
- Highlighted рядки для extreme rates (> 0.05%)

---

## Тест 5.13: Options Chain

**Кроки:**
1. Перейти на http://localhost:5173/options
2. Вибрати BTCUSDT

**Очікуваний результат:**
- Options chain таблиця: Calls ліворуч, Strikes по центру, Puts праворуч
- ATM рядок виділений золотим
- Max Pain ціна та bar chart
- Put/Call ratio badge
- IV Smile chart (V-подібна крива)

---

## Тест 5.14: Quantis Script Editor

**Кроки:**
1. Перейти на http://localhost:5173/script-editor

**Очікуваний результат:**
- Текстовий редактор з номерами рядків
- Syntax highlighting (золотий = keywords, зелений = числа)

**Кроки:**
2. Зліва натиснути "EMA Crossover Strategy"

**Очікуваний результат:**
- Код шаблону завантажується в редактор

**Кроки:**
3. Натиснути "Run"

**Очікуваний результат:**
- Toast: "Script execution coming soon"

**Кроки:**
4. Натиснути "Save", ввести ім'я "My Script"

**Очікуваний результат:**
- Скрипт з'являється в Saved Scripts списку

---

## Тест 5.15: Arbitrage Scanner

**Кроки:**
1. Перейти на http://localhost:5173/arbitrage

**Очікуваний результат:**
- 3 вкладки: Cross-Exchange, Funding Rate, Triangular
- За замовчуванням відкрита Cross-Exchange

**Кроки:**
2. На вкладці Cross-Exchange:

**Очікуваний результат:**
- Таблиця з парами: Symbol, Buy Exchange, Sell Exchange, Spread %, Est. Profit
- Spread > 0 виділений зеленим
- Auto-refresh toggle (on/off)
- Profit Calculator: ввести суму → побачити estimated profit

**Кроки:**
3. Переключити на вкладку Funding Rate

**Очікуваний результат:**
- Таблиця: Symbol, Exchange A Rate, Exchange B Rate, Spread, Annualized %
- Extreme spreads виділені

**Кроки:**
4. Переключити на вкладку Triangular

**Очікуваний результат:**
- Список трикутних можливостей: Path (наприклад BTC→ETH→USDT→BTC), Profit %, Exchange
- Positive profit paths виділені зеленим

---

## Тест 5.16: Strategy Backtester

**Кроки:**
1. Перейти на http://localhost:5173/backtester

**Очікуваний результат:**
- Форма: Symbol dropdown, Timeframe dropdown, Date Range (from/to)
- Preset Strategies: RSI Mean Reversion, EMA Crossover, Bollinger Bounce
- Custom strategy builder: entry/exit conditions, SL%, TP%

**Кроки:**
2. Вибрати BTCUSDT, 1h, від 2026-01-01 до 2026-03-01
3. Вибрати preset "RSI Mean Reversion"
4. Натиснути "Run Backtest"

**Очікуваний результат:**
- Equity Curve chart (лінійний графік)
- Stats: Total Trades, Win Rate %, Profit Factor, Max Drawdown %, Sharpe Ratio, Total Return %
- Trade list: entry/exit dates, P&L per trade
- Порівняння з Buy & Hold

---

## Тест 5.17: Grid Bot

**Кроки:**
1. Перейти на http://localhost:5173/grid-bot

**Очікуваний результат:**
- Форма Create Grid Bot: Symbol, Upper Price, Lower Price, Grid Levels, Investment Amount
- Grid Preview (візуалізація рівнів на ціновому графіку)

**Кроки:**
2. Заповнити: BTCUSDT, Upper: 72000, Lower: 65000, Levels: 10, Amount: $5000
3. Натиснути "Preview"

**Очікуваний результат:**
- Grid Preview показує 10 горизонтальних ліній між 65000 і 72000
- Кожен рівень: ціна, тип (buy/sell), розмір ордера

**Кроки:**
4. Натиснути "Simulate"

**Очікуваний результат:**
- Simulation results: Total Trades, Grid Profit, Unrealized P&L, APR %
- Equity curve за період симуляції
- Бот з'являється в Active Bots списку зі статусом "Simulated"

---

### Тест 5.18: DEX-CEX Arbitrage
1. Navigate to /arbitrage
2. Click "DEX-CEX" tab
3. Verify opportunities load (or show "No opportunities" if none available)
4. Check each row shows: Token, DEX name, DEX price, CEX exchange, CEX price, Spread %, Direction
5. Verify spread % calculation is correct (|DEX - CEX| / min(DEX, CEX) * 100)

---

### Тест 5.19: Arbitrage Fee Accounting
1. On Cross-Exchange tab, verify "Fees" and "Net Profit" columns are visible
2. Check that Fees shows buy_fee + sell_fee (e.g., 0.20% for Binance↔Bybit)
3. Verify Net Profit = Spread - Fees
4. Confirm negative net profits shown in red

---

### Тест 5.20: Arbitrage Alerts
1. Click the bell icon (🔔) next to Auto-refresh
2. Enter threshold (e.g., 0.5%)
3. Click "Create Alert"
4. Verify success response
5. Check alert appears in /alerts page

---

### Тест 5.21: AI Morning Brief
1. Navigate to /copilot
2. Verify "Morning Brief" card appears above chat
3. Check it shows: market summary, top gainers/losers, BTC/ETH prices
4. Click collapse button to minimize
5. Click "Refresh" to reload brief
6. Verify rate limit (1 per hour)

---

### Тест 5.22: Portfolio Analytics
1. Navigate to /portfolio
2. Check "Performance Analytics" section
3. Verify stat cards: Win Rate, Profit Factor, Sharpe Ratio, Max Drawdown, Total P&L
4. If paper trades exist, verify equity curve chart renders
5. Verify monthly returns bars show correctly
6. If no trades, verify "Start paper trading to see analytics" message

---

### Тест 5.23: Quick Price Alerts (Watchlist)
1. On Dashboard, find watchlist strip
2. Click bell icon on any coin (e.g., BTC)
3. Verify alert dropdown shows current price
4. Enter target price, click "Alert Above"
5. Verify toast "Alert created: BTC above $XX,XXX"
6. Click bell on another coin, verify separate dropdown
