# Environment Variables Reference

All variables are defined in `.env.example`. Copy to `.env` and fill in values.

## Global

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | `development` / `staging` / `production` |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `APP_URL` | Yes | `http://localhost:5173` | Public URL of the frontend |
| `CORS_ORIGINS` | Yes | `http://localhost:5173,http://localhost:3001` | Allowed CORS origins (comma-separated) |

## Database (PostgreSQL + TimescaleDB)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | Yes | `localhost` | PostgreSQL host |
| `DB_PORT` | Yes | `5433` | PostgreSQL port |
| `DB_NAME` | Yes | `quantis` | Database name |
| `DB_USER` | Yes | `quantis` | Database user |
| `DB_PASSWORD` | Yes | — | Database password (must match docker-compose) |
| `DB_SSL` | No | `false` | Enable SSL for DB connection |
| `DB_POOL_MIN` | No | `5` | Minimum connection pool |
| `DB_POOL_MAX` | No | `20` | Maximum connection pool |

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | Yes | `localhost` | Redis host |
| `REDIS_PORT` | Yes | `6381` | Redis port |
| `REDIS_PASSWORD` | Prod | — | Redis password (empty for dev) |
| `REDIS_DB` | No | `0` | Redis database index |

## Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | Yes | — | Secret key for JWT access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | Secret key for JWT refresh tokens |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token expiration |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiration |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt salt rounds |

## Exchange API Keys Encryption

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_KEY_ENCRYPTION_KEY` | Yes | — | AES-256-GCM key (32 bytes, hex-encoded) |

## Exchange Data Collection

| Variable | Required | Default | Description |
|---|---|---|---|
| `BINANCE_API_URL` | No | `https://api.binance.com` | Binance REST API |
| `BINANCE_WS_URL` | No | `wss://stream.binance.com:9443` | Binance WebSocket |
| `BYBIT_API_URL` | No | `https://api.bybit.com` | Bybit REST API |
| `BYBIT_WS_URL` | No | `wss://stream.bybit.com` | Bybit WebSocket |
| `OKX_API_URL` | No | `https://www.okx.com` | OKX REST API |
| `OKX_WS_URL` | No | `wss://ws.okx.com:8443` | OKX WebSocket |

## Payment Gateway (NOWPayments)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOWPAYMENTS_API_KEY` | Prod | — | NOWPayments API key |
| `NOWPAYMENTS_IPN_SECRET` | Prod | — | IPN callback secret |
| `NOWPAYMENTS_SANDBOX` | No | `true` | Use sandbox mode |

## Email (SMTP)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | Prod | — | SMTP server (e.g., smtp.resend.com) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | Prod | — | SMTP username |
| `SMTP_PASSWORD` | Prod | — | SMTP password |
| `SMTP_FROM` | Prod | `noreply@quantis.io` | Sender email |

## Telegram Bot

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Prod | — | Bot token from @BotFather |

## AI Copilot (Anthropic)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | — | Claude API key (mock analysis without it) |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Claude model |
| `COPILOT_MAX_TOKENS` | No | `2000` | Max response tokens |
| `COPILOT_TEMPERATURE` | No | `0.3` | AI temperature |

## Monitoring & Admin

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_EMAILS` | Yes | `admin@quantis.io` | Admin emails (comma-separated) |
| `SENTRY_DSN` | No | — | Sentry error tracking |

## Production

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSL_CERT_PATH` | Prod | — | Let's Encrypt cert path |
| `SSL_KEY_PATH` | Prod | — | Let's Encrypt key path |
| `DOMAIN` | Prod | `quantis.io` | Production domain |

## Generating Secrets

```bash
# JWT secrets (64 random chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# AES-256 encryption key (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
