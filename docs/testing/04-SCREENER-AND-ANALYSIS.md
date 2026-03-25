# 04 — Тестування Screener та аналітики

---

## Тест 4.1: Screener основний

**Кроки:**
1. Перейти на http://localhost:5173/screener

**Очікуваний результат:**
- Таблиця з 20 парами (Binance 10 + Bybit 5 + OKX 5)
- 7 колонок: Pair, Exchange, Price, 24H%, Volume, RSI, Trend
- RSI має кольорову полоску (зелена < 30, жовта 30-70, червона > 70)
- Trend badge: Bullish (зелений), Bearish (червоний), Neutral (сірий)

---

## Тест 4.2: Screener фільтри

**Кроки:**
1. Вибрати Exchange: "Binance"

**Очікуваний результат:**
- Показує тільки 10 Binance пар

**Кроки:**
2. Вибрати Trend: "Bullish"

**Очікуваний результат:**
- Показує тільки пари з Bullish trend badge

**Кроки:**
3. Натиснути "Oversold (RSI<30)"

**Очікуваний результат:**
- Показує тільки пари з RSI < 30 (може бути 0 якщо жодна не oversold)

**Кроки:**
4. Натиснути "All" (скинути фільтри)

---

## Тест 4.3: Screener сортування

**Кроки:**
1. Натиснути заголовок "Price"

**Очікуваний результат:**
- Таблиця сортується за ціною (desc → asc при повторному кліку)
- Активний заголовок виділений золотим

**Кроки:**
2. Натиснути "RSI"

**Очікуваний результат:**
- Сортується за RSI

---

## Тест 4.4: Screener пошук

**Кроки:**
1. Ввести "ETH" в поле пошуку

**Очікуваний результат:**
- Фільтрується до ETHUSDT (Binance) + ETHUSDT (Bybit) + ETHUSDT (OKX)

---

## Тест 4.5: Screener → Chart

**Кроки:**
1. Клікнути на будь-який рядок в таблиці

**Очікуваний результат:**
- Перехід на /chart/SYMBOL з графіком цієї пари

---

## Тест 4.6: Market Heatmap

**Кроки:**
1. Перейти на http://localhost:5173/heatmap

**Очікуваний результат:**
- Grid з блоками для кожної пари
- Розмір блоку пропорційний volume
- Колір: зелений (positive change), червоний (negative change)
- Кожен блок показує символ та % зміни

**Кроки:**
2. Переключити "Color by" на "RSI"

**Очікуваний результат:**
- Кольори змінюються на базі RSI значень

**Кроки:**
3. Клікнути на BTC блок

**Очікуваний результат:**
- Перехід на /chart/BTCUSDT

---

## Тест 4.7: Correlation Matrix

**Кроки:**
1. Перейти на http://localhost:5173/correlation

**Очікуваний результат:**
- 20x20 таблиця-матриця
- Діагональ = 1.00 (золотий колір)
- Кольори: синій (від'ємна кореляція) → сірий (0) → червоний (позитивна)
- Значення з 2 десятковими (наприклад 0.77)

---

## Тест 4.8: Confluence Map

**Кроки:**
1. Перейти на http://localhost:5173/confluence
2. Вибрати BTCUSDT

**Очікуваний результат:**
- Поточна ціна відображається
- Список confluence zones відсортований за кількістю джерел
- Кожна зона показує: ціну, strength badge, source badges (EMA, S/R, BB...)
- Відстань від поточної ціни в %

---

## Тест 4.9: Pattern Scanner

**Кроки:**
1. Перейти на http://localhost:5173/pattern-scanner
2. Вибрати BTCUSDT

**Очікуваний результат:**
- Summary: кількість патернів, bullish/bearish count
- Картки патернів: назва, тип (bullish зелений / bearish червоний), confidence bar, опис
- Можливі патерни: Double Bottom, Bullish Engulfing, Doji, Hammer...

---

## Тест 4.10: Advanced Patterns (Elliott Wave + Harmonic + Wyckoff)

**Кроки:**
1. Перейти на http://localhost:5173/advanced-patterns
2. Вибрати BTCUSDT

**Очікуваний результат:**
- 3 вкладки: Elliott Wave, Harmonic, Wyckoff
- За замовчуванням відкрита Elliott Wave

**Кроки (Elliott Wave tab):**
3. На вкладці Elliott Wave:

**Очікуваний результат:**
- Pattern badge: Impulse / Correction / None
- Якщо знайдено: список wave points з цінами (Wave 1, 2, 3, 4, 5 або A, B, C)
- Fibonacci targets
- Confidence bar

**Кроки (Harmonic tab):**
4. Переключити на вкладку Harmonic

**Очікуваний результат:**
- Список знайдених патернів (Gartley, Butterfly, Bat, Crab) або "No patterns found"
- Кожен патерн: XABCD точки з цінами, ratios, PRZ zone, confidence

**Кроки (Wyckoff tab):**
5. Переключити на вкладку Wyckoff

**Очікуваний результат:**
- Великий badge фази: Accumulation (зелений), Markup (зелений), Distribution (червоний), Markdown (червоний)
- Volume analysis: порівняння up/down volume
- Detected events список
- Trading implication

---

## Тест 4.11: Advanced Charts (Renko + Market Profile + Order Flow)

**Кроки:**
1. Перейти на http://localhost:5173/advanced-charts
2. Вибрати BTCUSDT

**Очікуваний результат:**
- 3 вкладки: Renko, Market Profile, Order Flow
- За замовчуванням відкрита Renko

**Кроки (Order Flow tab):**
3. Переключити на вкладку Order Flow

**Очікуваний результат:**
- Summary: Total Buys, Total Sells, Net Delta, Dominant Side
- Cumulative delta chart (canvas лінія)
- Footprint таблиця: зелені/червоні клітинки за delta magnitude

**Кроки (Market Profile tab):**
4. Переключити на вкладку Market Profile

**Очікуваний результат:**
- Horizontal volume bars (canvas)
- POC виділений золотим
- VA range заштрихований
- Stats: POC ціна, VA High, VA Low, Distribution shape
