# 01 — Тестування автентифікації

## Передумови
- Сайт запущений: http://localhost:5173
- API працює: http://localhost:3001/health → `{"status":"ok"}`

---

## Тест 1.1: Реєстрація нового користувача

**Кроки:**
1. Відкрити http://localhost:5173
2. Натиснути "Get Started Free" або перейти на http://localhost:5173/register
3. Ввести email: `user1@test.com`
4. Ввести пароль: `MyPassword123`
5. Ввести підтвердження паролю: `MyPassword123`
6. Натиснути "Create Account"

**Очікуваний результат:**
- З'являється Onboarding Wizard (3 кроки)
- Або перенаправляє на /dashboard
- В DevTools → Network видно POST /api/v1/auth/register → 201
- Відповідь містить `accessToken` та `refreshToken`

---

## Тест 1.2: Реєстрація з вже існуючим email

**Кроки:**
1. Перейти на http://localhost:5173/register
2. Ввести той самий email: `user1@test.com`
3. Ввести пароль: `MyPassword123`
4. Натиснути "Create Account"

**Очікуваний результат:**
- Помилка: "Email already registered"
- Статус 409 в Network tab

---

## Тест 1.3: Реєстрація зі слабким паролем

**Кроки:**
1. Перейти на http://localhost:5173/register
2. Ввести email: `user2@test.com`
3. Ввести пароль: `123` (занадто короткий)
4. Натиснути "Create Account"

**Очікуваний результат:**
- Помилка валідації біля поля пароля
- Запит не відправляється (клієнтська валідація)

---

## Тест 1.4: Логін з правильними даними

**Кроки:**
1. Перейти на http://localhost:5173/login
2. Ввести email: `user1@test.com`
3. Ввести пароль: `MyPassword123`
4. Натиснути "Log In"

**Очікуваний результат:**
- Перенаправлення на /dashboard
- В хедері з'являється аватар користувача (літера U або перша літера email)
- Sidebar показує всі навігаційні пункти

---

## Тест 1.5: Логін з неправильним паролем

**Кроки:**
1. Перейти на http://localhost:5173/login
2. Ввести email: `user1@test.com`
3. Ввести пароль: `WrongPassword999`
4. Натиснути "Log In"

**Очікуваний результат:**
- Повідомлення про помилку (червоний блок)
- Залишаємось на сторінці логіну
- В Network: POST /api/v1/auth/login → 401

---

## Тест 1.6: Профіль користувача

**Кроки:**
1. Залогінитись (Тест 1.4)
2. Перейти на http://localhost:5173/settings

**Очікуваний результат:**
- Відображається email користувача
- Поле Display Name (можна редагувати)
- Timezone selector
- Кнопка "Save Changes"

---

## Тест 1.7: Зміна профілю

**Кроки:**
1. На сторінці Settings ввести Display Name: `Trader One`
2. Вибрати Timezone: `Europe/Kyiv`
3. Натиснути "Save Changes"

**Очікуваний результат:**
- Повідомлення про успішне збереження (toast)
- Оновити сторінку — дані збережені

---

## Тест 1.8: Налаштування 2FA

**Кроки:**
1. На сторінці Settings знайти секцію "Two-Factor Authentication"
2. Натиснути "Enable 2FA"

**Очікуваний результат:**
- З'являється TOTP secret (32 символи)
- QR Code URL для Google Authenticator
- Поле для введення 6-значного коду

**Кроки (продовження):**
3. Ввести будь-який 6-значний код: `123456`
4. Натиснути "Verify"

**Очікуваний результат:**
- Повідомлення "2FA enabled successfully"
- Статус змінюється на "Enabled"

---

## Тест 1.9: Вихід з акаунту

**Кроки:**
1. На сторінці Settings натиснути "Log Out"

**Очікуваний результат:**
- Перенаправлення на Landing page (/)
- Хедер показує кнопку "Log In" замість аватара
- Спроба відкрити /dashboard перенаправляє на /

---

## Тест 1.10: Onboarding Wizard (після реєстрації)

**Кроки:**
1. Зареєструвати нового користувача (новий email)
2. Після реєстрації має з'явитись Onboarding

**Очікуваний результат (Крок 1/3):**
- "What's your trading experience?"
- 3 карточки: Beginner / Intermediate / Advanced
- Вибрати одну → виділяється золотою рамкою

**Очікуваний результат (Крок 2/3):**
- "Pick assets for your watchlist"
- 10 монет як toggle-чіпи
- Вибрати 3-5

**Очікуваний результат (Крок 3/3):**
- "Pick your preferred look"
- Dark / Light preview
- Натиснути "Get Started" → Dashboard

---

## API тестування (curl)

```bash
# Реєстрація
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"apitest@test.com","password":"TestPass1234"}'

# Логін
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"apitest@test.com","password":"TestPass1234"}'

# Профіль (вставити токен з відповіді логіну)
curl http://localhost:3001/api/v1/auth/me \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'

# 2FA Setup
curl -X POST http://localhost:3001/api/v1/auth/2fa/setup \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```
