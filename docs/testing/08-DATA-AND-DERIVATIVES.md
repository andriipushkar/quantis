# 08 — Тестування Data feeds, Derivatives, DeFi

---

## Тест 8.1: Exchange Health

**Кроки:**
1. Перейти на http://localhost:5173/exchange-health

**Очікуваний результат:**
- 3 карточки: Binance, Bybit, OKX
- Кожна: health score gauge, status badge (Healthy зелений / Degraded жовтий)
- Metrics: active pairs, data freshness, WS status
- Auto-refresh кожні 30с
- "Last checked" timestamp

---

## Тест 8.2: Open Interest

**Кроки:**
1. Перейти на http://localhost:5173/open-interest

**Очікуваний результат:**
- Summary: Total OI, 24H Change, Divergence Count
- Таблиця: Symbol, OI ($M), 24H Change %, Volume, OI/Vol Ratio
- Divergence flags (коли price і OI рухаються в різних напрямках)
- Сортування за OI desc

---

## Тест 8.3: Funding Rates (детально)

**Кроки:**
1. Перейти на http://localhost:5173/funding-rates

**Очікуваний результат:**
- 20 пар в таблиці
- Rate: зелений (negative = shorts pay), червоний (positive = longs pay)
- Annualized %
- Next Funding: countdown таймер (оновлюється кожну секунду)
- Prediction arrows (↑/↓)
- Summary: avg rate, most extreme pair

---

## Тест 8.4: Seasonality

**Кроки:**
1. Перейти на http://localhost:5173/seasonality
2. Вибрати BTCUSDT

**Очікуваний результат:**
- Hourly Heatmap: 24 колонки (години 0-23 UTC)
  - Зелені = позитивний avg return
  - Червоні = негативний
  - Tooltip при наведенні: avg return %, win rate
- Day of Week: 7 bar chart (Mon-Sun)
  - Бари зліва для negative, справа для positive
  - Win rate label

---

## Тест 8.5: Market Breadth

**Кроки:**
1. Перейти на http://localhost:5173/market-breadth

**Очікуваний результат:**
- Breadth Score gauge (0-100): Strong Bull (>70), Neutral (30-70), Weak (<30)
- Stats grid: Advancing count, Declining count, % Above SMA20, Avg RSI, New Highs/Lows
- Market interpretation text

---

## Тест 8.6: Narratives

**Кроки:**
1. Перейти на http://localhost:5173/narratives

**Очікуваний результат:**
- 6 sector карточок відсортованих за score
- Кожен: sector name, score badge (кольоровий), trend arrow (rising/falling/stable)
- Avg Change %, tokens в секторі з індивідуальними змінами
- "Sector Rotation" пояснення

---

## Тест 8.7: DeFi Dashboard

**Кроки:**
1. Перейти на http://localhost:5173/defi

**Очікуваний результат:**
- Summary: Total TVL (~$66B), Protocol Count (10), Avg APY
- Таблиця: Name, Chain badge, Category, TVL ($B), 24H%, APY%, Risk (1-5)
- Сортування по TVL

**Кроки:**
2. Натиснути filter "Ethereum"

**Очікуваний результат:**
- Тільки Ethereum протоколи (Aave, Uniswap, Lido, Curve, MakerDAO, Compound)

**Кроки:**
3. Відсортувати за APY (клік на заголовок)

**Очікуваний результат:**
- Raydium (18.5%) або GMX (22%) вгорі

---

## Тест 8.8: Intermarket Analysis

**Кроки:**
1. Перейти на http://localhost:5173/intermarket

**Очікуваний результат:**
- Asset карточки по групам: Indices (S&P500, NASDAQ), Commodities (Gold, Silver, Oil), Bonds (10Y, 2Y), Forex (DXY)
- Кожен: ціна, 24h% change
- BTC Correlation grid: кольорове кодування (-1 до +1)
- Risk-On/Risk-Off badge

---

## Тест 8.9: On-Chain Analytics (Dev Activity + Network Metrics)

**Кроки:**
1. Перейти на http://localhost:5173/on-chain

**Очікуваний результат:**
- 2 вкладки: Dev Activity, Network Metrics
- За замовчуванням відкрита Dev Activity

**Кроки (Dev Activity tab):**
2. На вкладці Dev Activity:

**Очікуваний результат:**
- 5 проектів (BTC, ETH, SOL, DOT, LINK)
- Dev Score gauge bar для кожного
- Stats: Weekly Commits, Active Devs, GitHub Stars
- ETH має найвищий score (95)

**Кроки (Network Metrics tab):**
3. Переключити на вкладку Network Metrics
4. Вибрати BTC

**Очікуваний результат:**
- Health Score gauge: 88/100
- Metric cards: DAA (900k), Tx Count (350k), Transfer Value ($25B), NVT (45), Metcalfe Ratio
- Interpretation text

**Кроки:**
5. Переключити на SOL

**Очікуваний результат:**
- Інші значення: DAA (2M), Tx Count (40M)

---

## Тест 8.11: Bitcoin Models

**Кроки:**
1. Перейти на http://localhost:5173/btc-models

**Очікуваний результат:**
- Current BTC Price (крупно)
- Overall Consensus badge: undervalued / fair / overvalued
- 5 model карточок:
  - Stock-to-Flow: fair value ~$120k
  - Rainbow Chart: band name
  - Pi Cycle Top: signal status
  - MVRV Z-Score: z-value
  - Power Law: fair value
- Кожен: deviation %, signal badge (зелений/сірий/червоний)
- Disclaimer

---

## Тест 8.12: Token Scanner

**Кроки:**
1. Перейти на http://localhost:5173/token-scanner
2. Ввести "BTCUSDT" в пошук
3. Натиснути "Scan"

**Очікуваний результат:**
- Circular gauge: 87/100 "SAFE" (зелений)
- 6 факторів з individual bars:
  - Liquidity: 20/20
  - Data History: X/15
  - Volatility: X/15
  - Volume Consistency: X/15
  - Price Stability: X/15
  - Exchange Presence: X/20
- Recommendation text
- Recent Scans list (BTCUSDT додано)

**Кроки:**
4. Scan "DOGEUSDT"

**Очікуваний результат:**
- Нижчий score (DOGE більш волатильний)
- Recent Scans: DOGEUSDT, BTCUSDT
