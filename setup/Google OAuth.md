 Для активації:

  1. Створіть проєкт в Google Cloud Console
  2. Увімкніть Google Identity API
  3. Створіть OAuth 2.0 credentials
  4. Додайте в .env:
  GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-secret
  VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
  5. Запустіть міграцію: npm run db:migrate