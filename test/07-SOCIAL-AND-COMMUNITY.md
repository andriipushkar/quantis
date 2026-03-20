# 07 — Тестування Social, News, Academy, Gamification

---

## Тест 7.1: News Feed

**Кроки:**
1. Перейти на http://localhost:5173/news

**Очікуваний результат:**
- 12 новин у вигляді карточок
- Кожна: заголовок, опис, source badge, sentiment badge (Bullish зелений / Bearish червоний / Neutral сірий)
- Category tag, time ago

**Кроки:**
2. Вибрати Category: "Regulatory"

**Очікуваний результат:**
- Фільтрується до новин про регуляторику

**Кроки:**
3. Вибрати Sentiment: "Bullish"

**Очікуваний результат:**
- Тільки позитивні новини

---

## Тест 7.2: Whale Alert

**Кроки:**
1. Перейти на http://localhost:5173/whale-alert

**Очікуваний результат:**
- Summary: total alerts, biggest transaction, most active pair
- Feed: рядки з type badge (Inflow червоний / Outflow зелений / Transfer сірий)
- Symbol, Amount в $, time ago, exchange
- Оновлюється кожні 30 сек

---

## Тест 7.3: Social Feed — перегляд

**Кроки:**
1. Перейти на http://localhost:5173/social

**Очікуваний результат:**
- 10 mock постів від різних "користувачів"
- Кожен: avatar, ім'я, time ago, type badge (Trade Idea / Analysis / Comment)
- Direction badge якщо є (Bullish / Bearish)
- Content text, Like count
- Trending sidebar: top 5 symbols

---

## Тест 7.4: Social Feed — створення посту

**Кроки:**
1. Залогінитись
2. На сторінці Social Feed:
   - Type: Trade Idea
   - Symbol: BTCUSDT
   - Direction: Bullish
   - Content: "BTC looking strong above 70k, EMA crossover confirmed on 4H"
3. Натиснути "Post"

**Очікуваний результат:**
- Пост з'являється вгорі фіду
- Показує ваше ім'я/email, "just now", Trade Idea badge, Bullish badge

---

## Тест 7.5: Social Feed — лайк

**Кроки:**
1. Натиснути лайк (серце) на будь-якому пості

**Очікуваний результат:**
- Лічильник збільшується на 1
- Іконка змінює колір (заповнюється)
- Повторний клік — знімає лайк

---

## Тест 7.6: Academy — перегляд

**Кроки:**
1. Перейти на http://localhost:5173/academy

**Очікуваний результат:**
- Progress bar зверху (0/15 completed)
- 15 глав у вигляді карточок
- Перші 5 — "Available" (можна відкрити)
- 6-15 — "Locked" (іконка замка)
- Кожна: номер, назва, difficulty badge (Beginner/Intermediate/Advanced), час

---

## Тест 7.7: Academy — проходження глави

**Кроки:**
1. Клікнути на Chapter 1 "Introduction to Crypto Markets"

**Очікуваний результат:**
- Розкривається: довший опис, key concepts (3-4 bullet points)
- Кнопки: "Mark as Completed" та "Practice on Chart"

**Кроки:**
2. Натиснути "Mark as Completed"

**Очікуваний результат:**
- Глава позначена зеленою галочкою
- Progress bar: 1/15
- Chapter 6 може розблокуватись (якщо логіка послідовна)

**Кроки:**
3. Натиснути "Practice on Chart"

**Очікуваний результат:**
- Перехід на /chart/BTCUSDT

---

## Тест 7.8: Leaderboard

**Кроки:**
1. Перейти на http://localhost:5173/leaderboard

**Очікуваний результат (Tab: Paper Trading):**
- Таблиця: Rank, Name, Return %, Total Trades, Win Rate
- Top 3 з медалями (🥇🥈🥉 або gold/silver/bronze badges)

**Кроки:**
2. Переключити на tab "Signal Accuracy"

**Очікуваний результат:**
- Картки стратегій: strategy name, win rate, total signals, avg confidence

---

## Тест 7.9: Strategy Marketplace

**Кроки:**
1. Перейти на http://localhost:5173/marketplace

**Очікуваний результат:**
- 8 стратегій в grid
- Кожна: назва, type badge, creator, Win Rate, Return, Drawdown, Sharpe
- Star rating, Followers count, Price (Free або $X)

**Кроки:**
2. Натиснути "Follow" на стратегії

**Очікуваний результат:**
- Кнопка змінюється на "Unfollow"
- Followers count +1

---

## Тест 7.10: AI Copilot

**Кроки:**
1. Перейти на http://localhost:5173/copilot

**Очікуваний результат:**
- Chat інтерфейс з suggested questions
- Symbol selector dropdown

**Кроки:**
2. Клікнути "What do you think about BTC?"

**Очікуваний результат:**
- Typing dots animation
- Відповідь з аналізом (RSI, EMA, trend, Fear&Greed context)
- Context badges: Price, RSI, Trend, F&G score
- Disclaimer внизу

**Кроки:**
3. Ввести своє питання: "Is ETH oversold?"
4. Змінити symbol на ETHUSDT
5. Натиснути Send

**Очікуваний результат:**
- Аналіз ETH з відповідними даними

---

## Тест 7.11: Profile та Gamification

**Кроки:**
1. Перейти на http://localhost:5173/profile

**Очікуваний результат:**
- XP Progress Bar (Level X: Name)
- Stats: Total XP, Current Level, Achievements Earned, Streak Days
- Achievement Grid: 7 досягнень (earned кольорові, locked сірі)
- Recent Activity: список останніх XP нарахувань

---

## Тест 7.12: Referral

**Кроки:**
1. Перейти на http://localhost:5173/referral

**Очікуваний результат:**
- Referral link з кнопкою Copy
- Stats: Total Referrals (0), Total Earnings ($0), Pending ($0)
- "How it works" 3 кроки

**Кроки:**
2. Натиснути Copy

**Очікуваний результат:**
- Toast: "Referral link copied to clipboard!"
- Лінк в буфері обміну

---

## Тест 7.13: Influencer Tracker

**Кроки:**
1. Перейти на http://localhost:5173/influencers

**Очікуваний результат:**
- Consensus section: bullish/bearish/neutral по символам
- 10 influencer карточок: avatar, name, handle, followers, category badge
- Impact Score bar, Accuracy %, Recent mentions з sentiment

---

## Тест 7.14: Tokenomics

**Кроки:**
1. Перейти на http://localhost:5173/tokenomics
2. Натиснути "BTC"

**Очікуваний результат:**
- Supply gauge: 19.6M / 21M (93.3%)
- Inflation: 1.7%
- Score: 95/100
- FDV, unlock info
