# API Keys Setup

Guide for configuring all external service API keys.

## 1. NOWPayments (Crypto Payments)

**Required for:** Accepting cryptocurrency subscription payments

1. Register at https://nowpayments.io
2. Go to Store Settings → API Keys
3. Create an API key
4. Set up IPN (Instant Payment Notification):
   - IPN Callback URL: `https://yourdomain.com/api/v1/subscription/webhook`
   - Copy the IPN Secret Key

```env
NOWPAYMENTS_API_KEY=your-api-key-here
NOWPAYMENTS_IPN_SECRET=your-ipn-secret-here
NOWPAYMENTS_SANDBOX=false  # Set to true for testing
```

**Cost:** 0.5% per transaction

## 2. Anthropic (AI Copilot)

**Required for:** AI-powered market analysis chat

1. Register at https://console.anthropic.com
2. Go to API Keys → Create Key
3. Add credit ($5 minimum)

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

**Cost:** ~$3 per 1M input tokens, ~$15 per 1M output tokens
**Without key:** Platform uses rule-based analysis fallback (free)

## 3. Telegram Bot

**Required for:** Alert delivery via Telegram

1. Open Telegram, find @BotFather
2. Send `/newbot`
3. Follow instructions, get the bot token
4. Set bot commands:
   ```
   /start - Connect your account
   /alerts - View active alerts
   /status - Check connection status
   ```

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz
```

**Cost:** Free

## 4. Google OAuth (Sign in with Google)

**Required for:** Google login/registration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create project → Enable Google Identity Services API
3. OAuth consent screen → External → Add `email` + `profile` scopes
4. Create OAuth client ID (Web application)
5. Add Authorized JavaScript origins: `http://localhost:5173`
6. Add Authorized redirect URIs: `http://localhost:5173/auth/google/callback`
7. Copy Client ID and Client Secret

```env
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
VITE_GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
```

**Cost:** Free
**Without key:** Google button hidden, email/password auth still works
**Full guide:** See `setup/Google OAuth.md`

## 5. SMTP (Email)

**Required for:** Alert emails, weekly reports, password reset

### Option A: Resend (Recommended)
1. Register at https://resend.com
2. Verify your domain
3. Get API key

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxx
SMTP_FROM=noreply@quantis.io
```

**Cost:** Free (3,000 emails/month), then $20/month

### Option B: Gmail (Testing only)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

## 5. Domain & SSL

**Required for:** Production deployment

1. Buy domain (e.g., quantis.io) from Namecheap/Cloudflare
2. Point DNS to your server IP
3. SSL is auto-configured with Let's Encrypt via certbot

```env
DOMAIN=quantis.io
```

Initial SSL setup:
```bash
# First time only
docker compose exec certbot certbot certonly --webroot \
  -w /var/www/certbot -d quantis.io -d www.quantis.io
```

**Cost:** Domain ~$10/year, SSL free

## 6. Cloudflare (CDN + DDoS Protection)

**Optional but recommended**

1. Register at https://cloudflare.com
2. Add your domain
3. Change nameservers to Cloudflare's
4. Enable:
   - Proxy (orange cloud) for A record
   - SSL: Full (Strict)
   - Bot Fight Mode: On
   - Under Attack Mode: available when needed

**Cost:** Free plan sufficient

## 7. Sentry (Error Tracking)

**Optional**

1. Register at https://sentry.io
2. Create Node.js project
3. Copy DSN

```env
SENTRY_DSN=https://xxxxx@sentry.io/12345
```

**Cost:** Free (5,000 errors/month)

## DexScreener API (Free)

DexScreener provides DEX token data and is used for DEX-CEX arbitrage comparison.

- **No API key required** — free public API
- **Rate limit:** ~300 requests per minute
- **Base URL:** `https://api.dexscreener.com/latest/dex`
- **Used by:** Arbitrage Scanner (DEX-CEX tab)
- **Circuit breaker:** Enabled with 5 failures / 30s recovery

## Quick Checklist

```
[ ] .env created from .env.example
[ ] JWT secrets generated (see 02-ENVIRONMENT-VARIABLES.md)
[ ] Database running (docker compose up -d postgres redis)
[ ] NOWPayments API key (for payments)
[ ] Google OAuth credentials (for Google login, optional)
[ ] Anthropic API key (for AI Copilot, optional)
[ ] Telegram bot token (for alerts, optional)
[ ] SMTP configured (for emails, optional)
[ ] Domain purchased (for production)
[ ] Cloudflare configured (for CDN, optional)
```
